import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  EventStatus as PrismaEventStatus,
  ContactRelationshipState as PrismaContactRelationshipState,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  Prisma,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { toSafeSmartCardConfig } from "../personas/persona-sharing";
import { userHasActiveTrustFactor } from "../auth/verification-policy.service";

import { CreateInstantConnectDto } from "./dto/create-instant-connect.dto";
import { CreatePublicInstantConnectDto } from "./dto/create-public-instant-connect.dto";

const noopBlocksService: Pick<
  BlocksService,
  "assertNoInteractionBlockInTransaction"
> = {
  assertNoInteractionBlockInTransaction: async () => undefined,
};

const noopContactMemoryService: Pick<
  ContactMemoryService,
  "upsertInteractionMemory"
> = {
  upsertInteractionMemory: async () => ({ id: "" }),
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
};

@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly blocksService: Pick<
      BlocksService,
      "assertNoInteractionBlockInTransaction"
    > = noopBlocksService,
    private readonly contactMemoryService: Pick<
      ContactMemoryService,
      "upsertInteractionMemory"
    > = noopContactMemoryService,
  ) {}

  async instantConnect(
    userId: string,
    createInstantConnectDto: CreateInstantConnectDto,
  ) {
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
        targetPersona,
        createInstantConnectDto.source,
        createInstantConnectDto.eventId,
      );
    });
  }

  async instantConnectByUsername(
    userId: string,
    username: string,
    createInstantConnectDto: CreatePublicInstantConnectDto = {},
  ) {
    return this.prismaService.$transaction(async (tx) => {
      const targetPersona = await tx.persona.findFirst({
        where: {
          username: username.trim().toLowerCase(),
        },
        select: instantConnectTargetSelect,
      });

      return this.instantConnectInTransaction(
        tx,
        userId,
        targetPersona,
        createInstantConnectDto.source,
        createInstantConnectDto.eventId,
      );
    });
  }

  private async instantConnectInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    targetPersona: InstantConnectTarget | null,
    source: ContactRequestSourceType | undefined,
    eventId?: string,
  ) {
    const actorPersona = await tx.persona.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
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
        throw new BadRequestException(
          "You cannot connect to your own persona",
        );
      }

      if (targetPersona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
        throw new ForbiddenException("Cannot connect to private profile");
      }

      await this.blocksService.assertNoInteractionBlockInTransaction(
        tx,
        userId,
        targetPersona.userId,
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

      const smartCardConfig = toSafeSmartCardConfig(targetPersona.smartCardConfig);
      const hasActiveProfileQr = await this.hasActiveProfileQr(tx, targetPersona.id);

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

      const eventSummary = await this.getEventSummary(tx, eventId);
      const sourceType = toPrismaSourceType(source);
      const relationshipContext = this.buildRelationshipContext(
        source,
        eventSummary,
      );
      const connectedAt = new Date();
      const relationship = await this.createOrPromoteApprovedRelationship(tx, {
        ownerUserId: userId,
        targetUserId: targetPersona.userId,
        ownerPersonaId: actorPersona.id,
        targetPersonaId: targetPersona.id,
        sourceType,
        connectionContext: relationshipContext,
      });

      await Promise.all([
        this.contactMemoryService.upsertInteractionMemory(tx, {
          relationshipId: relationship.id,
          eventId: relationshipContext.eventId,
          contextLabel:
            relationshipContext.label ?? toMemoryContextLabel(source, eventSummary),
          metAt: connectedAt,
          sourceLabel: toInstantConnectSourceLabel(source),
        }),
        this.updateInteractionMetadata(tx, relationship.id, connectedAt),
        relationship.reciprocalRelationshipId
          ? this.updateInteractionMetadata(
              tx,
              relationship.reciprocalRelationshipId,
              connectedAt,
            )
          : Promise.resolve(null),
      ]);

      return {
        success: true,
        relationshipId: relationship.id,
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
    },
  ) {
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

    await prisma.contactRelationship.updateMany({
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

  private async createOrPromoteApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      connectionContext: RelationshipConnectionContext;
    },
  ) {
    const relationshipId = await this.upsertApprovedRelationship(tx, {
      ownerUserId: data.ownerUserId,
      targetUserId: data.targetUserId,
      ownerPersonaId: data.ownerPersonaId,
      targetPersonaId: data.targetPersonaId,
      sourceType: data.sourceType,
      connectionContext: data.connectionContext,
    });

    const reciprocalRelationshipId = await this.upsertApprovedRelationship(tx, {
      ownerUserId: data.targetUserId,
      targetUserId: data.ownerUserId,
      ownerPersonaId: data.targetPersonaId,
      targetPersonaId: data.ownerPersonaId,
      sourceType: data.sourceType,
      connectionContext: data.connectionContext,
    });

    return {
      id: relationshipId,
      reciprocalRelationshipId,
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
            accessStartAt: data.accessStartAt,
            accessEndAt: data.accessEndAt,
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
        accessStartAt: data.accessStartAt,
        accessEndAt: data.accessEndAt,
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

  private async getOwnedRelationshipForMutation(
    tx: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const relationship = await tx.contactRelationship.findUnique({
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

    if (!relationship) {
      throw new NotFoundException("Relationship not found");
    }

    if (relationship.ownerUserId !== userId) {
      throw new ForbiddenException(
        "You are not allowed to update this relationship",
      );
    }

    return relationship;
  }

  private async upsertApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      connectionContext: RelationshipConnectionContext;
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
            sourceId: null,
            connectionContext: this.attachEventContext(data.connectionContext),
            accessStartAt: null,
            accessEndAt: null,
          },
          select: {
            id: true,
          },
        });

        return createdRelationship.id;
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
            return relationship.id;
          }
        }

        throw error;
      }
    }

    if (
      existingRelationship.state === PrismaContactRelationshipState.APPROVED &&
      existingRelationship.sourceType === data.sourceType &&
      existingRelationship.sourceId === null &&
      !this.hasConnectionContextChanged(
        existingRelationship.connectionContext,
        data.connectionContext,
      ) &&
      existingRelationship.accessStartAt === null &&
      existingRelationship.accessEndAt === null
    ) {
      return existingRelationship.id;
    }

    const updatedRelationship = await tx.contactRelationship.update({
      where: {
        id: existingRelationship.id,
      },
      data: {
        state: PrismaContactRelationshipState.APPROVED,
        sourceType: data.sourceType,
        sourceId: null,
        connectionContext: this.attachEventContext(data.connectionContext),
        accessStartAt: null,
        accessEndAt: null,
      },
      select: {
        id: true,
      },
    });

    return updatedRelationship.id;
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
