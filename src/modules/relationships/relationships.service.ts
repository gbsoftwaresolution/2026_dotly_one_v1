import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  EventStatus as PrismaEventStatus,
  ContactRelationshipState as PrismaContactRelationshipState,
  FollowUpStatus as PrismaFollowUpStatus,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  Prisma,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
  RelationshipConnectionSource as PrismaRelationshipConnectionSource,
} from "../../generated/prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { toSafeSmartCardConfig } from "../personas/persona-sharing";
import {
  userHasActiveTrustFactor,
  VerificationPolicyService,
} from "../auth/verification-policy.service";

import { CreateInstantConnectDto } from "./dto/create-instant-connect.dto";
import { CreateRelationshipInteractionDto } from "./dto/create-relationship-interaction.dto";
import { CreatePublicInstantConnectDto } from "./dto/create-public-instant-connect.dto";
import { InstantConnectSourcePolicyService } from "./instant-connect-source-policy.service";
import { RelationshipInteractionType } from "./relationship-interaction-type.enum";

const ACTIVITY_TIMELINE_LIMIT = 10;
const RECENT_INTERACTIONS_LIMIT = ACTIVITY_TIMELINE_LIMIT;
const RECENT_FOLLOW_UPS_LIMIT = ACTIVITY_TIMELINE_LIMIT * 2;
const INTERACTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const INTERACTION_RATE_LIMIT_MAX = 5;

const failClosedBlocksService: Pick<
  BlocksService,
  "assertNoInteractionBlockInTransaction"
> = {
  assertNoInteractionBlockInTransaction: async () => {
    throw new Error("Blocks service is not configured");
  },
};

const noopContactMemoryService: Pick<
  ContactMemoryService,
  "upsertInteractionMemory"
> = {
  upsertInteractionMemory: async () => ({ id: "" }),
};

const failClosedInstantConnectSourcePolicyService: Pick<
  InstantConnectSourcePolicyService,
  "assertSourceAccess"
> = {
  assertSourceAccess: async () => {
    throw new Error("Instant connect source policy is not configured");
  },
};

const failClosedVerificationPolicyService: Pick<
  VerificationPolicyService,
  "assertUserIsVerified"
> = {
  assertUserIsVerified: async () => {
    throw new Error("Verification policy service is not configured");
  },
};

const instantConnectTargetSelect = {
  id: true,
  userId: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
  verifiedOnly: true,
} as const;

type InstantConnectTarget = {
  id: string;
  userId: string;
  accessMode: PrismaPersonaAccessMode;
  sharingMode: PrismaPersonaSharingMode;
  smartCardConfig: Prisma.JsonValue | null;
  verifiedOnly: boolean;
};

type RelationshipContextType = "qr" | "profile" | "event";

type RelationshipConnectionContext = {
  type: RelationshipContextType;
  eventId: string | null;
  label: string | null;
};

type EventSummary = {
  id: string;
  name: string;
  startsAt: Date;
};

type RelationshipTimelineDefaults = {
  connectedAt: Date;
  metAt: Date;
  connectionSource: PrismaRelationshipConnectionSource;
  contextLabel: string | null;
  lastInteractionAt: Date;
};

type OwnedRelationshipNotesRow = {
  id: string;
  ownerUserId: string;
  notes: string | null;
  updatedAt: Date;
};

type UpdatedRelationshipNotesRow = {
  id: string;
  notes: string | null;
  updatedAt: Date;
};

type OwnedRelationshipInteractionRow = {
  id: string;
  ownerUserId: string;
  targetUserId: string;
  ownerPersonaId: string;
  targetPersonaId: string;
  state: PrismaContactRelationshipState;
  accessEndAt: Date | null;
};

type ReciprocalRelationshipRow = {
  id: string;
};

type InteractionCountRow = {
  count: number;
};

export type RecentRelationshipInteraction = {
  id: string;
  relationshipId: string;
  senderUserId: string;
  type: RelationshipInteractionType;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
};

type RecentRelationshipFollowUp = {
  id: string;
  createdAt: Date;
  completedAt: Date | null;
  status: PrismaFollowUpStatus;
};

export type RelationshipActivityTimelineEventType =
  | "CONNECTED"
  | "INTERACTION"
  | "FOLLOW_UP_CREATED"
  | "FOLLOW_UP_COMPLETED";

export type RelationshipActivityTimelineEvent = {
  id: string;
  type: RelationshipActivityTimelineEventType;
  label: string;
  timestamp: Date;
};

@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly blocksService: BlocksService =
      failClosedBlocksService as BlocksService,
    @Optional()
    private readonly contactMemoryService: ContactMemoryService =
      noopContactMemoryService as ContactMemoryService,
    @Optional()
    private readonly verificationPolicyService: VerificationPolicyService =
      failClosedVerificationPolicyService as VerificationPolicyService,
    @Optional()
    private readonly instantConnectSourcePolicyService: InstantConnectSourcePolicyService =
      failClosedInstantConnectSourcePolicyService as InstantConnectSourcePolicyService,
  ) {}

  async instantConnect(
    userId: string,
    createInstantConnectDto: CreateInstantConnectDto,
  ) {
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "instant_connect",
    );

    return this.prismaService.$transaction(async (tx) => {
      const targetPersona = await tx.persona.findUnique({
        where: {
          id: createInstantConnectDto.targetPersonaId,
        },
        select: instantConnectTargetSelect,
      });

      return this.instantConnectInTransaction(
        tx,
        userId,
        createInstantConnectDto.fromPersonaId,
        targetPersona,
        createInstantConnectDto.source,
        createInstantConnectDto.eventId,
      );
    });
  }

  async instantConnectByUsername(
    userId: string,
    username: string,
    createInstantConnectDto: CreatePublicInstantConnectDto,
  ) {
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "instant_connect",
    );

    return this.prismaService.$transaction(async (tx) => {
      const targetPersona = await tx.persona.findFirst({
        where: {
          username: username.trim().toLowerCase(),
          accessMode: {
            not: PrismaPersonaAccessMode.PRIVATE,
          },
        },
        select: instantConnectTargetSelect,
      });

      return this.instantConnectInTransaction(
        tx,
        userId,
        createInstantConnectDto.fromPersonaId,
        targetPersona,
        createInstantConnectDto.source,
        createInstantConnectDto.eventId,
      );
    });
  }

  private async instantConnectInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    fromPersonaId: string,
    targetPersona: InstantConnectTarget | null,
    source: ContactRequestSourceType | undefined,
    eventId?: string,
  ) {
    const actorPersona = await tx.persona.findFirst({
      where: {
        id: fromPersonaId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!actorPersona) {
      throw new NotFoundException("Persona not found");
    }

    if (!targetPersona) {
      throw new NotFoundException("Target persona not found");
    }

    if (targetPersona.userId === userId) {
      throw new BadRequestException("You cannot connect to your own persona");
    }

    if (targetPersona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      throw new ForbiddenException("Cannot connect to private profile");
    }

    await this.blocksService.assertNoInteractionBlockInTransaction(
      tx,
      userId,
      targetPersona.userId,
    );

    await this.instantConnectSourcePolicyService.assertSourceAccess(
      userId,
      actorPersona.id,
      targetPersona.id,
      source,
      eventId,
    );

    const actorUser = await tx.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isVerified: true,
        phoneVerifiedAt: true,
      },
    });

    if (!actorUser) {
      throw new NotFoundException("User not found");
    }

    if (targetPersona.verifiedOnly && !userHasActiveTrustFactor(actorUser)) {
      throw new ForbiddenException("Verified profiles only");
    }

    const smartCardConfig = toSafeSmartCardConfig(
      targetPersona.smartCardConfig,
    );
    const hasActiveProfileQr = await this.hasActiveProfileQr(
      tx,
      targetPersona.id,
    );

    if (
      targetPersona.sharingMode !== PrismaPersonaSharingMode.SMART_CARD ||
      smartCardConfig?.primaryAction !==
        PersonaSmartCardPrimaryAction.InstantConnect ||
      !hasActiveProfileQr
    ) {
      throw new ForbiddenException(
        "Instant connect is not available for this persona",
      );
    }

    const eventSummary =
      source === ContactRequestSourceType.Event
        ? await this.getRequiredEventSummary(tx, eventId!)
        : null;
    const sourceType = toPrismaSourceType(source);
    const relationshipContext = this.buildRelationshipContext(
      source,
      eventSummary,
    );
    const connectedAt = new Date();
    const relationshipResult = await this.createOrPromoteApprovedRelationship(
      tx,
      {
        ownerUserId: userId,
        targetUserId: targetPersona.userId,
        ownerPersonaId: actorPersona.id,
        targetPersonaId: targetPersona.id,
        sourceType,
        sourceId:
          source === ContactRequestSourceType.Event ? (eventId ?? null) : null,
        connectionContext: relationshipContext,
        connectedAt,
        metAt: eventSummary?.startsAt ?? connectedAt,
        connectionSource: toRelationshipConnectionSource(sourceType),
        contextLabel: eventSummary?.name ?? null,
        lastInteractionAt: connectedAt,
      },
    );

    if (relationshipResult.wasCreatedOrChanged) {
      await Promise.all([
        this.contactMemoryService.upsertInteractionMemory(tx, {
          relationshipId: relationshipResult.id,
          eventId: relationshipContext.eventId,
          contextLabel:
            relationshipContext.label ??
            toMemoryContextLabel(source, eventSummary),
          metAt: connectedAt,
          sourceLabel: toInstantConnectSourceLabel(source),
        }),
        this.updateInteractionMetadata(tx, relationshipResult.id, connectedAt),
        relationshipResult.reciprocalRelationshipId
          ? this.updateInteractionMetadata(
              tx,
              relationshipResult.reciprocalRelationshipId,
              connectedAt,
            )
          : Promise.resolve(null),
      ]);
    }

    return {
      relationshipId: relationshipResult.id,
      status: "connected" as const,
    };
  }

  async createApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
      connectionContext?: RelationshipConnectionContext | null;
      connectedAt?: Date;
      metAt?: Date | null;
      connectionSource?: PrismaRelationshipConnectionSource;
      contextLabel?: string | null;
      lastInteractionAt?: Date | null;
    },
  ) {
    const timeline = await this.resolveRelationshipTimelineDefaults(tx, {
      sourceType: data.sourceType,
      sourceId: data.sourceId ?? null,
      connectionContext: data.connectionContext ?? null,
      connectedAt: data.connectedAt,
      metAt: data.metAt,
      connectionSource: data.connectionSource,
      contextLabel: data.contextLabel,
      lastInteractionAt: data.lastInteractionAt,
    });

    try {
      const relationship = await tx.contactRelationship.create({
        data: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
          state: PrismaContactRelationshipState.APPROVED,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
          connectedAt: timeline.connectedAt,
          metAt: timeline.metAt,
          connectionSource: timeline.connectionSource,
          contextLabel: timeline.contextLabel,
          lastInteractionAt: timeline.lastInteractionAt,
          ...(data.connectionContext
            ? {
                connectionContext: this.attachEventContext(
                  data.connectionContext,
                ),
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      const reciprocalRelationship = await tx.contactRelationship.create({
        data: {
          ownerUserId: data.targetUserId,
          targetUserId: data.ownerUserId,
          ownerPersonaId: data.targetPersonaId,
          targetPersonaId: data.ownerPersonaId,
          state: PrismaContactRelationshipState.APPROVED,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
          connectedAt: timeline.connectedAt,
          metAt: timeline.metAt,
          connectionSource: timeline.connectionSource,
          contextLabel: timeline.contextLabel,
          lastInteractionAt: timeline.lastInteractionAt,
          ...(data.connectionContext
            ? {
                connectionContext: this.attachEventContext(
                  data.connectionContext,
                ),
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      return {
        id: relationship.id,
        reciprocalRelationshipId: reciprocalRelationship.id,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Contact relationship already exists");
      }

      throw error;
    }
  }

  async updateInteractionMetadata(
    prisma: Prisma.TransactionClient | PrismaService,
    relationshipId: string,
    interactionAt: Date = new Date(),
  ) {
    if (Number.isNaN(interactionAt.getTime())) {
      throw new Error("Invalid interaction timestamp");
    }

    const updateResult = await prisma.contactRelationship.updateMany({
      where: {
        id: relationshipId,
      },
      data: {
        interactionCount: {
          increment: 1,
        },
      },
    });

    if (updateResult.count !== 1) {
      return null;
    }

    await this.updateLastInteractionAt(prisma, relationshipId, interactionAt);

    return prisma.contactRelationship.findUnique({
      where: {
        id: relationshipId,
      },
      select: {
        id: true,
        lastInteractionAt: true,
        interactionCount: true,
      },
    });
  }

  async updateLastInteractionAt(
    prisma: Prisma.TransactionClient | PrismaService,
    relationshipId: string,
    interactionAt: Date = new Date(),
  ) {
    if (Number.isNaN(interactionAt.getTime())) {
      throw new Error("Invalid interaction timestamp");
    }

    const updateResult = await prisma.contactRelationship.updateMany({
      where: {
        id: relationshipId,
        OR: [
          {
            lastInteractionAt: null,
          },
          {
            lastInteractionAt: {
              lt: interactionAt,
            },
          },
        ],
      },
      data: {
        lastInteractionAt: interactionAt,
      },
    });

    if (updateResult.count !== 1) {
      return null;
    }

    return prisma.contactRelationship.findUnique({
      where: {
        id: relationshipId,
      },
      select: {
        id: true,
        lastInteractionAt: true,
      },
    });
  }

  async getRelationshipTimeline(
    userId: string,
    relationshipId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const relationship = await prisma.contactRelationship.findFirst({
      where: {
        id: relationshipId,
        ownerUserId: userId,
      },
      select: {
        createdAt: true,
        connectedAt: true,
        metAt: true,
        connectionSource: true,
        contextLabel: true,
        lastInteractionAt: true,
      },
    });

    if (!relationship) {
      throw new NotFoundException("Relationship not found");
    }

    const connectedAt = relationship.connectedAt ?? relationship.createdAt;

    return {
      connectedAt,
      metAt: relationship.metAt ?? connectedAt,
      connectionSource: relationship.connectionSource,
      contextLabel: relationship.contextLabel ?? null,
      lastInteractionAt: relationship.lastInteractionAt ?? null,
    };
  }

  async getRelationshipActivityTimeline(
    userId: string,
    relationshipId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<RelationshipActivityTimelineEvent[]> {
    const relationship = await prisma.contactRelationship.findFirst({
      where: {
        id: relationshipId,
        ownerUserId: userId,
      },
      select: {
        createdAt: true,
        connectedAt: true,
      },
    });

    if (!relationship) {
      throw new NotFoundException("Relationship not found");
    }

    const [interactions, followUps] = await Promise.all([
      this.getRecentInteractions(
        relationshipId,
        ACTIVITY_TIMELINE_LIMIT,
        prisma,
      ),
      this.getRecentFollowUpsForTimeline(
        prisma,
        userId,
        relationshipId,
        RECENT_FOLLOW_UPS_LIMIT,
      ),
    ]);

    const events: RelationshipActivityTimelineEvent[] = [
      {
        id: `connected-${relationshipId}`,
        type: "CONNECTED",
        label: "Connected",
        timestamp: relationship.connectedAt ?? relationship.createdAt,
      },
      ...interactions.map((interaction) => ({
        id: `interaction-${interaction.id}`,
        type: "INTERACTION" as const,
        label: toRelationshipInteractionTimelineLabel(
          interaction.type,
          interaction.senderUserId === userId ? "sent" : "received",
        ),
        timestamp: interaction.createdAt,
      })),
      ...followUps.flatMap((followUp) => {
        const followUpEvents: RelationshipActivityTimelineEvent[] = [
          {
            id: `follow-up-created-${followUp.id}`,
            type: "FOLLOW_UP_CREATED",
            label: "Set a reminder",
            timestamp: followUp.createdAt,
          },
        ];

        if (
          followUp.status === PrismaFollowUpStatus.COMPLETED &&
          followUp.completedAt
        ) {
          followUpEvents.push({
            id: `follow-up-completed-${followUp.id}`,
            type: "FOLLOW_UP_COMPLETED",
            label: "Completed a follow-up",
            timestamp: followUp.completedAt,
          });
        }

        return followUpEvents;
      }),
    ];

    return events
      .sort((left, right) => {
        const timestampDifference =
          right.timestamp.getTime() - left.timestamp.getTime();

        if (timestampDifference !== 0) {
          return timestampDifference;
        }

        return right.id.localeCompare(left.id);
      })
      .slice(0, ACTIVITY_TIMELINE_LIMIT);
  }

  async updateOwnedRelationshipNotes(
    userId: string,
    relationshipId: string,
    input: { notes?: string | null },
  ) {
    const normalizedNotes = input.notes ?? null;

    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipNotesForUpdate(
        tx,
        userId,
        relationshipId,
      );

      if ((relationship.notes ?? null) === normalizedNotes) {
        return {
          id: relationship.id,
          notes: relationship.notes,
          updatedAt: relationship.updatedAt,
        };
      }

      const now = new Date();
      const [updatedRelationship] = await tx.$queryRaw<
        UpdatedRelationshipNotesRow[]
      >(Prisma.sql`
        UPDATE "ContactRelationship"
        SET
          "notes" = ${normalizedNotes},
          "updatedAt" = ${now}
        WHERE "id" = ${relationshipId}::uuid
          AND "ownerUserId" = ${userId}::uuid
        RETURNING "id", "notes", "updatedAt"
      `);

      if (!updatedRelationship) {
        throw new NotFoundException("Relationship not found");
      }

      return updatedRelationship;
    });
  }

  async createInteraction(
    userId: string,
    relationshipId: string,
    input: CreateRelationshipInteractionDto,
  ) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForInteraction(
        tx,
        userId,
        relationshipId,
      );
      const normalizedRelationship = await this.expireRelationshipIfNeeded(
        tx,
        relationship,
      );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        throw new ConflictException(
          "Expired relationships cannot receive interactions",
        );
      }

      await this.blocksService.assertNoInteractionBlockInTransaction(
        tx,
        userId,
        normalizedRelationship.targetUserId,
      );

      const interactionAt = new Date();

      await this.assertInteractionRateLimit(
        tx,
        normalizedRelationship.id,
        userId,
        interactionAt,
      );

      const reciprocalRelationship = await this.getReciprocalRelationship(
        tx,
        normalizedRelationship,
      );

      await Promise.all([
        this.insertInteraction(tx, {
          relationshipId: normalizedRelationship.id,
          senderUserId: userId,
          type: input.type,
          payload: null,
          createdAt: interactionAt,
        }),
        reciprocalRelationship
          ? this.insertInteraction(tx, {
              relationshipId: reciprocalRelationship.id,
              senderUserId: userId,
              type: input.type,
              payload: null,
              createdAt: interactionAt,
            })
          : Promise.resolve(),
        this.updateInteractionMetadata(
          tx,
          normalizedRelationship.id,
          interactionAt,
        ),
        reciprocalRelationship
          ? this.updateInteractionMetadata(
              tx,
              reciprocalRelationship.id,
              interactionAt,
            )
          : Promise.resolve(null),
      ]);

      return {
        success: true,
      };
    });
  }

  async getRecentInteractions(
    relationshipId: string,
    limit = RECENT_INTERACTIONS_LIMIT,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const safeLimit = Math.max(1, Math.min(limit, RECENT_INTERACTIONS_LIMIT));

    return prisma.$queryRaw<RecentRelationshipInteraction[]>(Prisma.sql`
      SELECT
        "id",
        "relationshipId",
        "senderUserId",
        "type",
        "payload",
        "createdAt"
      FROM "Interaction"
      WHERE "relationshipId" = ${relationshipId}::uuid
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${safeLimit}
    `);
  }

  private async getRecentFollowUpsForTimeline(
    prisma: Prisma.TransactionClient | PrismaService,
    userId: string,
    relationshipId: string,
    limit = RECENT_FOLLOW_UPS_LIMIT,
  ): Promise<RecentRelationshipFollowUp[]> {
    const safeLimit = Math.max(1, Math.min(limit, RECENT_FOLLOW_UPS_LIMIT));

    return prisma.followUp.findMany({
      where: {
        ownerUserId: userId,
        relationshipId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: safeLimit,
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        status: true,
      },
    });
  }

  private async createOrPromoteApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
      connectionContext: RelationshipConnectionContext;
      connectedAt: Date;
      metAt: Date;
      connectionSource: PrismaRelationshipConnectionSource;
      contextLabel: string | null;
      lastInteractionAt: Date;
    },
  ) {
    const relationshipResult = await this.upsertApprovedRelationship(tx, {
      ownerUserId: data.ownerUserId,
      targetUserId: data.targetUserId,
      ownerPersonaId: data.ownerPersonaId,
      targetPersonaId: data.targetPersonaId,
      sourceType: data.sourceType,
      sourceId: data.sourceId ?? null,
      connectionContext: data.connectionContext,
      connectedAt: data.connectedAt,
      metAt: data.metAt,
      connectionSource: data.connectionSource,
      contextLabel: data.contextLabel,
      lastInteractionAt: data.lastInteractionAt,
    });

    const reciprocalRelationshipResult = await this.upsertApprovedRelationship(
      tx,
      {
        ownerUserId: data.targetUserId,
        targetUserId: data.ownerUserId,
        ownerPersonaId: data.targetPersonaId,
        targetPersonaId: data.ownerPersonaId,
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        connectionContext: data.connectionContext,
        connectedAt: data.connectedAt,
        metAt: data.metAt,
        connectionSource: data.connectionSource,
        contextLabel: data.contextLabel,
        lastInteractionAt: data.lastInteractionAt,
      },
    );

    return {
      id: relationshipResult.id,
      reciprocalRelationshipId: reciprocalRelationshipResult.id,
      wasCreatedOrChanged:
        relationshipResult.wasCreatedOrChanged ||
        reciprocalRelationshipResult.wasCreatedOrChanged,
    };
  }

  async createOrRefreshInstantAccessRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceId: string;
      accessStartAt: Date;
      accessEndAt: Date;
    },
  ) {
    const existingRelationship = await tx.contactRelationship.findUnique({
      where: {
        ownerUserId_targetUserId_ownerPersonaId_targetPersonaId: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
        },
      },
      select: {
        id: true,
        state: true,
        accessEndAt: true,
      },
    });

    if (!existingRelationship) {
      try {
        return await tx.contactRelationship.create({
          data: {
            ownerUserId: data.ownerUserId,
            targetUserId: data.targetUserId,
            ownerPersonaId: data.ownerPersonaId,
            targetPersonaId: data.targetPersonaId,
            state: PrismaContactRelationshipState.INSTANT_ACCESS,
            sourceType: PrismaContactRequestSourceType.QR,
            sourceId: data.sourceId,
            connectedAt: data.accessStartAt,
            metAt: data.accessStartAt,
            connectionSource: PrismaRelationshipConnectionSource.QR,
            contextLabel: null,
            accessStartAt: data.accessStartAt,
            accessEndAt: data.accessEndAt,
            lastInteractionAt: data.accessStartAt,
          },
          select: {
            id: true,
            state: true,
            accessStartAt: true,
            accessEndAt: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException(
            "An active instant access relationship already exists",
          );
        }

        throw error;
      }
    }

    const normalizedRelationship = await this.expireRelationshipIfNeeded(
      tx,
      existingRelationship,
    );

    if (
      normalizedRelationship.state === PrismaContactRelationshipState.APPROVED
    ) {
      throw new ConflictException("Contact relationship already exists");
    }

    if (
      normalizedRelationship.state ===
      PrismaContactRelationshipState.INSTANT_ACCESS
    ) {
      throw new ConflictException(
        "An active instant access relationship already exists",
      );
    }

    return tx.contactRelationship.update({
      where: {
        id: normalizedRelationship.id,
      },
      data: {
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        sourceType: PrismaContactRequestSourceType.QR,
        sourceId: data.sourceId,
        connectedAt: data.accessStartAt,
        metAt: data.accessStartAt,
        connectionSource: PrismaRelationshipConnectionSource.QR,
        contextLabel: null,
        accessStartAt: data.accessStartAt,
        accessEndAt: data.accessEndAt,
        lastInteractionAt: data.accessStartAt,
      },
      select: {
        id: true,
        state: true,
        accessStartAt: true,
        accessEndAt: true,
      },
    });
  }

  async upgradeOwnedRelationship(userId: string, relationshipId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForMutation(
        tx,
        userId,
        relationshipId,
      );
      const normalizedRelationship = await this.expireRelationshipIfNeeded(
        tx,
        relationship,
      );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        throw new ConflictException(
          "Expired instant access relationships cannot be upgraded",
        );
      }

      if (
        normalizedRelationship.state !==
        PrismaContactRelationshipState.INSTANT_ACCESS
      ) {
        throw new ConflictException(
          "Only instant access relationships can be upgraded",
        );
      }

      await tx.contactRelationship.update({
        where: {
          id: normalizedRelationship.id,
        },
        data: {
          state: PrismaContactRelationshipState.APPROVED,
          accessStartAt: null,
          accessEndAt: null,
        },
      });

      return {
        relationshipId: normalizedRelationship.id,
        state: "approved" as const,
      };
    });
  }

  async expireOwnedRelationship(userId: string, relationshipId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForMutation(
        tx,
        userId,
        relationshipId,
      );
      const normalizedRelationship = await this.expireRelationshipIfNeeded(
        tx,
        relationship,
      );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        return {
          relationshipId: normalizedRelationship.id,
          state: "expired" as const,
        };
      }

      if (
        normalizedRelationship.state !==
        PrismaContactRelationshipState.INSTANT_ACCESS
      ) {
        throw new ConflictException(
          "Only instant access relationships can be expired",
        );
      }

      await tx.contactRelationship.update({
        where: {
          id: normalizedRelationship.id,
        },
        data: {
          state: PrismaContactRelationshipState.EXPIRED,
          accessEndAt:
            normalizedRelationship.accessEndAt !== null &&
            normalizedRelationship.accessEndAt < new Date()
              ? normalizedRelationship.accessEndAt
              : new Date(),
        },
      });

      return {
        relationshipId: normalizedRelationship.id,
        state: "expired" as const,
      };
    });
  }

  async expireExpiredRelationships(
    userId?: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    await prisma.contactRelationship.updateMany({
      where: {
        ...(userId
          ? {
              ownerUserId: userId,
            }
          : {}),
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        accessEndAt: {
          lt: new Date(),
        },
      },
      data: {
        state: PrismaContactRelationshipState.EXPIRED,
      },
    });
  }

  async expireOwnedExpiredRelationships(
    userId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    await this.expireExpiredRelationships(userId, prisma);
  }

  async expireRelationshipIfNeeded<
    T extends {
      id: string;
      state: PrismaContactRelationshipState;
      accessEndAt: Date | null;
    },
  >(
    prisma: Prisma.TransactionClient | PrismaService,
    relationship: T,
  ): Promise<T> {
    if (
      relationship.state !== PrismaContactRelationshipState.INSTANT_ACCESS ||
      relationship.accessEndAt === null ||
      relationship.accessEndAt >= new Date()
    ) {
      return relationship;
    }

    await prisma.contactRelationship.updateMany({
      where: {
        id: relationship.id,
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
      },
      data: {
        state: PrismaContactRelationshipState.EXPIRED,
        accessEndAt: relationship.accessEndAt,
      },
    });

    return {
      ...relationship,
      state: PrismaContactRelationshipState.EXPIRED,
    };
  }

  private async assertInteractionRateLimit(
    tx: Prisma.TransactionClient,
    relationshipId: string,
    senderUserId: string,
    interactionAt: Date,
  ) {
    const windowStart = new Date(
      interactionAt.getTime() - INTERACTION_RATE_LIMIT_WINDOW_MS,
    );
    const [interactionCount] = await tx.$queryRaw<InteractionCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "Interaction"
        WHERE "relationshipId" = ${relationshipId}::uuid
          AND "senderUserId" = ${senderUserId}::uuid
          AND "createdAt" >= ${windowStart}
      `,
    );

    if ((interactionCount?.count ?? 0) >= INTERACTION_RATE_LIMIT_MAX) {
      throw new HttpException(
        "Too many interactions right now. Please wait before sending another signal.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async getOwnedRelationshipForMutation(
    tx: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const relationshipDelegate = tx.contactRelationship as unknown as {
      findFirst?: (args: {
        where: { id: string; ownerUserId: string };
        select: {
          id: true;
          state: true;
          accessEndAt: true;
        };
      }) => Promise<{
        id: string;
        state: PrismaContactRelationshipState;
        accessEndAt: Date | null;
      } | null>;
      findUnique?: (args: {
        where: { id: string };
        select: {
          id: true;
          ownerUserId: true;
          state: true;
          accessEndAt: true;
        };
      }) => Promise<{
        id: string;
        ownerUserId: string;
        state: PrismaContactRelationshipState;
        accessEndAt: Date | null;
      } | null>;
    };

    const relationship =
      typeof relationshipDelegate.findFirst === "function"
        ? await relationshipDelegate.findFirst({
            where: {
              id: relationshipId,
              ownerUserId: userId,
            },
            select: {
              id: true,
              state: true,
              accessEndAt: true,
            },
          })
        : await relationshipDelegate.findUnique?.({
            where: {
              id: relationshipId,
            },
            select: {
              id: true,
              ownerUserId: true,
              state: true,
              accessEndAt: true,
            },
          });

    if (
      !relationship ||
      ("ownerUserId" in relationship && relationship.ownerUserId !== userId)
    ) {
      throw new NotFoundException("Relationship not found");
    }

    return relationship;
  }

  private async getOwnedRelationshipForInteraction(
    tx: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const [relationship] = await tx.$queryRaw<OwnedRelationshipInteractionRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "ownerUserId",
          "targetUserId",
          "ownerPersonaId",
          "targetPersonaId",
          "state",
          "accessEndAt"
        FROM "ContactRelationship"
        WHERE "id" = ${relationshipId}::uuid
        LIMIT 1
      `,
    );

    if (!relationship || relationship.ownerUserId !== userId) {
      throw new NotFoundException("Relationship not found");
    }

    return relationship;
  }

  private async getOwnedRelationshipNotesForUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const [relationship] = await tx.$queryRaw<OwnedRelationshipNotesRow[]>(
      Prisma.sql`
        SELECT "id", "ownerUserId", "notes", "updatedAt"
        FROM "ContactRelationship"
        WHERE "id" = ${relationshipId}::uuid
        LIMIT 1
      `,
    );

    if (!relationship || relationship.ownerUserId !== userId) {
      throw new NotFoundException("Relationship not found");
    }

    return relationship;
  }

  private async getReciprocalRelationship(
    tx: Prisma.TransactionClient,
    relationship: OwnedRelationshipInteractionRow,
  ) {
    const [reciprocalRelationship] =
      await tx.$queryRaw<ReciprocalRelationshipRow[]>(Prisma.sql`
        SELECT "id"
        FROM "ContactRelationship"
        WHERE "ownerUserId" = ${relationship.targetUserId}::uuid
          AND "targetUserId" = ${relationship.ownerUserId}::uuid
          AND "ownerPersonaId" = ${relationship.targetPersonaId}::uuid
          AND "targetPersonaId" = ${relationship.ownerPersonaId}::uuid
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT 1
      `);

    return reciprocalRelationship ?? null;
  }

  private async insertInteraction(
    tx: Prisma.TransactionClient,
    data: {
      relationshipId: string;
      senderUserId: string;
      type: RelationshipInteractionType;
      payload: Prisma.JsonValue | null;
      createdAt: Date;
    },
  ) {
    const serializedPayload =
      data.payload === null ? null : JSON.stringify(data.payload);
    const interactionId = randomUUID();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Interaction" (
        "id",
        "relationshipId",
        "senderUserId",
        "type",
        "payload",
        "createdAt"
      )
      VALUES (
        ${interactionId}::uuid,
        ${data.relationshipId}::uuid,
        ${data.senderUserId}::uuid,
        CAST(${data.type} AS "InteractionType"),
        CAST(${serializedPayload} AS jsonb),
        ${data.createdAt}
      )
    `);
  }

  private async upsertApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
      connectionContext: RelationshipConnectionContext;
      connectedAt: Date;
      metAt: Date;
      connectionSource: PrismaRelationshipConnectionSource;
      contextLabel: string | null;
      lastInteractionAt: Date;
    },
  ) {
    const existingRelationship = await tx.contactRelationship.findUnique({
      where: {
        ownerUserId_targetUserId_ownerPersonaId_targetPersonaId: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
        },
      },
      select: {
        id: true,
        state: true,
        sourceType: true,
        sourceId: true,
        connectionContext: true,
        accessStartAt: true,
        accessEndAt: true,
      },
    });

    if (!existingRelationship) {
      try {
        const createdRelationship = await tx.contactRelationship.create({
          data: {
            ownerUserId: data.ownerUserId,
            targetUserId: data.targetUserId,
            ownerPersonaId: data.ownerPersonaId,
            targetPersonaId: data.targetPersonaId,
            state: PrismaContactRelationshipState.APPROVED,
            sourceType: data.sourceType,
            sourceId: data.sourceId ?? null,
            connectionContext: this.attachEventContext(data.connectionContext),
            connectedAt: data.connectedAt,
            metAt: data.metAt,
            connectionSource: data.connectionSource,
            contextLabel: data.contextLabel,
            accessStartAt: null,
            accessEndAt: null,
            lastInteractionAt: data.lastInteractionAt,
          },
          select: {
            id: true,
          },
        });

        return {
          id: createdRelationship.id,
          wasCreatedOrChanged: true,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const relationship = await tx.contactRelationship.findUnique({
            where: {
              ownerUserId_targetUserId_ownerPersonaId_targetPersonaId: {
                ownerUserId: data.ownerUserId,
                targetUserId: data.targetUserId,
                ownerPersonaId: data.ownerPersonaId,
                targetPersonaId: data.targetPersonaId,
              },
            },
            select: {
              id: true,
            },
          });

          if (relationship) {
            return {
              id: relationship.id,
              wasCreatedOrChanged: false,
            };
          }
        }

        throw error;
      }
    }

    if (
      existingRelationship.state === PrismaContactRelationshipState.APPROVED &&
      existingRelationship.accessStartAt === null &&
      existingRelationship.accessEndAt === null
    ) {
      return {
        id: existingRelationship.id,
        wasCreatedOrChanged: false,
      };
    }

    const updatedRelationship = await tx.contactRelationship.update({
      where: {
        id: existingRelationship.id,
      },
      data: {
        state: PrismaContactRelationshipState.APPROVED,
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        connectionContext: this.attachEventContext(data.connectionContext),
        connectedAt: data.connectedAt,
        metAt: data.metAt,
        connectionSource: data.connectionSource,
        contextLabel: data.contextLabel,
        accessStartAt: null,
        accessEndAt: null,
        lastInteractionAt: data.lastInteractionAt,
      },
      select: {
        id: true,
      },
    });

    return {
      id: updatedRelationship.id,
      wasCreatedOrChanged: true,
    };
  }

  private async hasActiveProfileQr(
    tx: Prisma.TransactionClient,
    personaId: string,
  ) {
    const activeProfileQr = await tx.qRAccessToken.findFirst({
      where: {
        personaId,
        type: PrismaQrType.profile,
        status: PrismaQrStatus.active,
      },
      select: {
        id: true,
      },
    });

    return activeProfileQr !== null;
  }

  private attachEventContext(
    context: RelationshipConnectionContext,
  ): Prisma.InputJsonValue {
    return {
      type: context.type,
      eventId: context.eventId,
      label: context.label,
    } satisfies Prisma.InputJsonObject;
  }

  private async getEventSummary(
    tx: Prisma.TransactionClient,
    eventId?: string,
  ): Promise<EventSummary | null> {
    if (!eventId) {
      return null;
    }

    const event = await tx.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    });

    if (!event) {
      return null;
    }

    const now = new Date();

    if (
      event.status === PrismaEventStatus.DRAFT ||
      event.startsAt > now ||
      event.endsAt <= now
    ) {
      return null;
    }

    return {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
    };
  }

  private async getRequiredEventSummary(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<EventSummary> {
    const eventSummary = await this.getEventSummary(tx, eventId);

    if (eventSummary === null) {
      throw new BadRequestException("Event networking is not active");
    }

    return eventSummary;
  }

  private async resolveRelationshipTimelineDefaults(
    tx: Prisma.TransactionClient,
    data: {
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
      connectionContext?: RelationshipConnectionContext | null;
      connectedAt?: Date;
      metAt?: Date | null;
      connectionSource?: PrismaRelationshipConnectionSource;
      contextLabel?: string | null;
      lastInteractionAt?: Date | null;
    },
  ): Promise<RelationshipTimelineDefaults> {
    const connectedAt = data.connectedAt ?? new Date();
    const eventTimeline =
      data.sourceType === PrismaContactRequestSourceType.EVENT && data.sourceId
        ? await this.getRelationshipTimelineEvent(tx, data.sourceId)
        : null;

    return {
      connectedAt,
      metAt: data.metAt ?? eventTimeline?.startsAt ?? connectedAt,
      connectionSource:
        data.connectionSource ??
        toRelationshipConnectionSource(data.sourceType),
      contextLabel:
        normalizeTimelineContextLabel(data.contextLabel) ??
        normalizeTimelineContextLabel(eventTimeline?.name) ??
        (data.sourceType === PrismaContactRequestSourceType.EVENT
          ? normalizeTimelineContextLabel(data.connectionContext?.label)
          : null),
      lastInteractionAt: data.lastInteractionAt ?? connectedAt,
    };
  }

  private async getRelationshipTimelineEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
  ) {
    const event = await tx.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        name: true,
        startsAt: true,
      },
    });

    if (!event) {
      return null;
    }

    return {
      name: event.name,
      startsAt: event.startsAt,
    };
  }

  private buildRelationshipContext(
    sourceType: ContactRequestSourceType | undefined,
    eventSummary: EventSummary | null,
  ): RelationshipConnectionContext {
    if (eventSummary) {
      return {
        type: "event",
        eventId: eventSummary.id,
        label: eventSummary.name,
      };
    }

    const contextType = toRelationshipContextType(sourceType);

    return {
      type: contextType,
      eventId: null,
      label: toSourceContextLabel(sourceType),
    };
  }

  private hasConnectionContextChanged(
    currentValue: Prisma.JsonValue | null,
    nextValue: RelationshipConnectionContext,
  ) {
    const currentContext = readStoredConnectionContext(currentValue);

    return (
      currentContext?.type !== nextValue.type ||
      currentContext?.eventId !== nextValue.eventId ||
      (currentContext?.label ?? null) !== nextValue.label
    );
  }
}

function toPrismaSourceType(
  sourceType: ContactRequestSourceType | undefined,
): PrismaContactRequestSourceType {
  switch (sourceType) {
    case ContactRequestSourceType.Qr:
      return PrismaContactRequestSourceType.QR;
    case ContactRequestSourceType.Event:
      return PrismaContactRequestSourceType.EVENT;
    case ContactRequestSourceType.Profile:
    case undefined:
      return PrismaContactRequestSourceType.PROFILE;
  }
}

function toRelationshipConnectionSource(
  sourceType: PrismaContactRequestSourceType,
): PrismaRelationshipConnectionSource {
  switch (sourceType) {
    case PrismaContactRequestSourceType.QR:
      return PrismaRelationshipConnectionSource.QR;
    case PrismaContactRequestSourceType.EVENT:
      return PrismaRelationshipConnectionSource.EVENT;
    case PrismaContactRequestSourceType.PROFILE:
      return PrismaRelationshipConnectionSource.MANUAL;
  }
}

function normalizeTimelineContextLabel(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toRelationshipInteractionTimelineLabel(
  type: RelationshipInteractionType,
  direction: "sent" | "received",
) {
  switch (type) {
    case RelationshipInteractionType.GREETING:
      return direction === "sent" ? "You said hi" : "They said hi";
    case RelationshipInteractionType.FOLLOW_UP:
      return direction === "sent" ? "You followed up" : "They followed up";
    case RelationshipInteractionType.THANK_YOU:
      return direction === "sent" ? "You sent thanks" : "They sent thanks";
  }
}

function toInstantConnectSourceLabel(
  sourceType: ContactRequestSourceType | undefined,
) {
  switch (sourceType) {
    case ContactRequestSourceType.Qr:
      return "Instant connect via QR";
    case ContactRequestSourceType.Event:
      return "Instant connect via Event";
    case ContactRequestSourceType.Profile:
      return "Instant connect via Profile";
    case undefined:
      return "Instant connect";
  }
}

function toMemoryContextLabel(
  sourceType: ContactRequestSourceType | undefined,
  eventSummary: EventSummary | null,
) {
  return eventSummary?.name ?? toSourceContextLabel(sourceType);
}

function toSourceContextLabel(
  sourceType: ContactRequestSourceType | undefined,
): string {
  switch (sourceType) {
    case ContactRequestSourceType.Qr:
      return "QR";
    case ContactRequestSourceType.Event:
      return "Event";
    case ContactRequestSourceType.Profile:
    case undefined:
      return "Profile";
  }
}

function toRelationshipContextType(
  sourceType: ContactRequestSourceType | undefined,
): RelationshipContextType {
  switch (sourceType) {
    case ContactRequestSourceType.Qr:
      return "qr";
    case ContactRequestSourceType.Event:
      return "event";
    case ContactRequestSourceType.Profile:
    case undefined:
      return "profile";
  }
}

function readStoredConnectionContext(
  value: Prisma.JsonValue | null,
): RelationshipConnectionContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const type = candidate.type;
  const eventId = candidate.eventId;
  const label = candidate.label;

  if (type !== "qr" && type !== "profile" && type !== "event") {
    return null;
  }

  return {
    type,
    eventId: typeof eventId === "string" ? eventId : null,
    label: typeof label === "string" ? label : null,
  };
}
