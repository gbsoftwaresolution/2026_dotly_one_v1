import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  PersonaAccessMode as PrismaPersonaAccessMode,
  Prisma,
  RelationshipConnectionSource as PrismaRelationshipConnectionSource,
} from "../../generated/prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { FollowUpsService } from "../follow-ups/follow-ups.service";
import { RelationshipInteractionType } from "../relationships/relationship-interaction-type.enum";
import type { RecentRelationshipInteraction } from "../relationships/relationships.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { calculateRelationshipPriority } from "./relationship-priority.util";
import { UpdateContactNoteDto } from "./dto/update-contact-note.dto";

const RECENT_ACTIVITY_WINDOW_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CONTACT_DETAIL_RECENT_INTERACTIONS_LIMIT = 3;

const contactTargetPersonaSelect = {
  id: true,
  username: true,
  publicUrl: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  tagline: true,
  profilePhotoUrl: true,
} satisfies Prisma.PersonaSelect;

const contactListMemorySelect = {
  contextLabel: true,
  metAt: true,
  sourceLabel: true,
  note: true,
} satisfies Prisma.ContactMemorySelect;

const contactDetailMemorySelect = {
  id: true,
  eventId: true,
  contextLabel: true,
  metAt: true,
  sourceLabel: true,
  note: true,
} satisfies Prisma.ContactMemorySelect;

const contactListRelationshipSelect = {
  id: true,
  state: true,
  accessEndAt: true,
  lastInteractionAt: true,
  interactionCount: true,
  notes: true,
  createdAt: true,
  connectedAt: true,
  metAt: true,
  connectionSource: true,
  contextLabel: true,
  sourceType: true,
  connectionContext: true,
  targetPersona: {
    select: contactTargetPersonaSelect,
  },
  memories: {
    orderBy: {
      metAt: "desc",
    },
    take: 1,
    select: contactListMemorySelect,
  },
} satisfies Prisma.ContactRelationshipSelect;

const contactDetailRelationshipSelect = {
  ...contactListRelationshipSelect,
  accessStartAt: true,
  targetPersona: {
    select: {
      ...contactTargetPersonaSelect,
      accessMode: true,
    },
  },
  memories: {
    orderBy: {
      metAt: "desc",
    },
    take: 1,
    select: contactDetailMemorySelect,
  },
} satisfies Prisma.ContactRelationshipSelect;

type ContactListRelationshipRecord = Prisma.ContactRelationshipGetPayload<{
  select: typeof contactListRelationshipSelect;
}>;

type ContactDetailRelationshipRecord = Prisma.ContactRelationshipGetPayload<{
  select: typeof contactDetailRelationshipSelect;
}>;

type RelationshipMetadata = {
  lastInteractionAt: Date | null;
  interactionCount: number;
  hasInteractions: boolean;
  isRecentlyActive: boolean;
  relationshipAgeDays: number;
};

type RelationshipTimeline = {
  connectedAt: Date;
  metAt: Date;
  connectionSource: PrismaRelationshipConnectionSource;
  contextLabel: string | null;
};

type RelationshipFollowUpSummary = {
  hasPendingFollowUp: boolean;
  nextFollowUpAt: Date | null;
  pendingFollowUpCount: number;
  hasPassiveInactivityFollowUp: boolean;
  isTriggered: boolean;
  isOverdue: boolean;
  isUpcomingSoon: boolean;
};

type ContactDetailRecentInteraction = {
  id: string;
  type: RelationshipInteractionType;
  createdAt: Date;
  direction: "sent" | "received";
};

@Injectable()
export class ContactsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly relationshipsService: RelationshipsService,
    @Optional() private readonly followUpsService?: FollowUpsService,
  ) {}

  async findAll(userId: string, query: ListContactsQueryDto) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);
    const now = new Date();
    const recentActivityCutoff = getRecentActivityCutoff(now);
    const relationships = await this.prismaService.contactRelationship.findMany(
      {
        where: {
          ownerUserId: userId,
          OR: [
            {
              state: PrismaContactRelationshipState.APPROVED,
            },
            {
              state: PrismaContactRelationshipState.INSTANT_ACCESS,
              accessEndAt: {
                gt: now,
              },
            },
          ],
          ...(query.sourceType
            ? {
                sourceType: toPrismaContactRequestSourceType(query.sourceType),
              }
            : {}),
          ...(query.q
            ? {
                targetPersona: {
                  is: {
                    OR: [
                      {
                        fullName: {
                          contains: query.q,
                          mode: "insensitive",
                        },
                      },
                      {
                        companyName: {
                          contains: query.q,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              }
            : {}),
          ...(query.recent
            ? {
                lastInteractionAt: {
                  gte: recentActivityCutoff,
                  lte: now,
                },
              }
            : {}),
        },
        orderBy: [
          {
            lastInteractionAt: {
              sort: "desc",
              nulls: "last",
            },
          },
          {
            createdAt: "desc",
          },
          {
            id: "asc",
          },
        ],
        select: contactListRelationshipSelect,
      },
    );

    const followUpSummaries = await this.getFollowUpSummaries(
      userId,
      relationships.map((relationship) => relationship.id),
    );

    return relationships
      .map((relationship) =>
        this.toContactListItem(
          relationship,
          now,
          followUpSummaries.get(relationship.id) ?? buildEmptyFollowUpSummary(),
        ),
      )
      .sort(compareContactListItemsByPriority);
  }

  async findOne(userId: string, relationshipId: string) {
    const relationship = await this.getOwnedRelationship(
      userId,
      relationshipId,
    );
    const normalizedRelationship =
      await this.relationshipsService.expireRelationshipIfNeeded(
        this.prismaService,
        relationship,
      );

    if (
      normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
    ) {
      throw new NotFoundException("Contact not found");
    }

    const now = new Date();
    const recentInteractions = await this.getRecentInteractionsForDetail(
      userId,
      normalizedRelationship.id,
      now,
    );

    return this.toContactDetail(
      normalizedRelationship,
      now,
      await this.getFollowUpSummary(userId, normalizedRelationship.id),
      recentInteractions,
    );
  }

  async updateNote(
    userId: string,
    relationshipId: string,
    updateContactNoteDto: UpdateContactNoteDto,
  ) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationship(
        userId,
        relationshipId,
        tx,
      );
      const normalizedRelationship =
        await this.relationshipsService.expireRelationshipIfNeeded(
          tx,
          relationship,
        );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        throw new ConflictException(
          "Expired instant access relationships cannot be updated",
        );
      }

      const note = updateContactNoteDto.note;
      const existingNote = normalizedRelationship.notes ?? null;

      if (existingNote === note) {
        return {
          relationshipId: normalizedRelationship.id,
          note,
          lastInteractionAt: normalizedRelationship.lastInteractionAt ?? null,
          interactionCount: toSafeInteractionCount(
            normalizedRelationship.interactionCount,
          ),
        };
      }

      await tx.contactRelationship.update({
        where: {
          id: normalizedRelationship.id,
        },
        data: {
          notes: note,
        },
      });

      return {
        relationshipId: normalizedRelationship.id,
        note,
        lastInteractionAt: normalizedRelationship.lastInteractionAt ?? null,
        interactionCount: toSafeInteractionCount(
          normalizedRelationship.interactionCount,
        ),
      };
    });
  }

  async upgrade(userId: string, relationshipId: string) {
    return this.relationshipsService.upgradeOwnedRelationship(
      userId,
      relationshipId,
    );
  }

  async expire(userId: string, relationshipId: string) {
    return this.relationshipsService.expireOwnedRelationship(
      userId,
      relationshipId,
    );
  }

  private async getOwnedRelationship(
    userId: string,
    relationshipId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const relationship = await prisma.contactRelationship.findFirst({
      where: {
        id: relationshipId,
        ownerUserId: userId,
      },
      select: contactDetailRelationshipSelect,
    });

    if (!relationship) {
      throw new NotFoundException("Contact not found");
    }

    return relationship;
  }

  private toContactListItem(
    relationship: ContactListRelationshipRecord,
    now: Date,
    followUpSummary: RelationshipFollowUpSummary,
  ) {
    const timeline = this.buildRelationshipTimeline(relationship);
    const metadata = this.buildRelationshipMetadata(relationship, now);
    const sourceLabel = this.buildMemorySourceLabel(relationship);
    const contact = {
      id: relationship.targetPersona.id,
      username: relationship.targetPersona.username,
      publicUrl: relationship.targetPersona.publicUrl,
      fullName: relationship.targetPersona.fullName,
      jobTitle: relationship.targetPersona.jobTitle,
      companyName: relationship.targetPersona.companyName,
      tagline: relationship.targetPersona.tagline,
      profilePhotoUrl: relationship.targetPersona.profilePhotoUrl,
    };
    const priorityScore = calculateRelationshipPriority(
      {
        lastInteractionAt: metadata.lastInteractionAt,
        connectedAt: timeline.connectedAt,
        hasPendingFollowUp: followUpSummary.hasPendingFollowUp,
        isOverdue: followUpSummary.isOverdue,
        isUpcomingSoon: followUpSummary.isUpcomingSoon,
      },
      now,
    );

    return {
      id: relationship.id,
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      createdAt: relationship.createdAt,
      connectedAt: timeline.connectedAt,
      metAt: timeline.metAt,
      connectionSource: toApiRelationshipConnectionSource(
        timeline.connectionSource,
      ),
      contextLabel: timeline.contextLabel,
      accessEndAt: relationship.accessEndAt,
      priorityScore,
      lastInteractionAt: metadata.lastInteractionAt,
      hasPendingFollowUp: followUpSummary.hasPendingFollowUp,
      interactionCount: metadata.interactionCount,
      sourceType: toApiContactRequestSourceType(relationship.sourceType),
      contact,
      targetPersona: contact,
      memory: {
        metAt: timeline.metAt,
        sourceLabel,
        note: relationship.notes ?? null,
      },
      followUpSummary,
      metadata,
    };
  }

  private toContactDetail(
    relationship: ContactDetailRelationshipRecord,
    now: Date,
    followUpSummary: {
      hasPendingFollowUp: boolean;
      nextFollowUpAt: Date | null;
      pendingFollowUpCount: number;
      hasPassiveInactivityFollowUp: boolean;
      isTriggered: boolean;
      isOverdue: boolean;
      isUpcomingSoon: boolean;
    },
    recentInteractions: ContactDetailRecentInteraction[],
  ) {
    const memory = relationship.memories[0];
    const timeline = this.buildRelationshipTimeline(relationship);
    const metadata = this.buildRelationshipDetailMetadata(relationship, now);
    const sourceLabel = this.buildMemorySourceLabel(relationship);

    return {
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      accessStartAt: relationship.accessStartAt,
      accessEndAt: relationship.accessEndAt,
      isExpired: relationship.state === PrismaContactRelationshipState.EXPIRED,
      createdAt: relationship.createdAt,
      connectedAt: timeline.connectedAt,
      metAt: timeline.metAt,
      connectionSource: toApiRelationshipConnectionSource(
        timeline.connectionSource,
      ),
      contextLabel: timeline.contextLabel,
      lastInteractionAt: metadata.lastInteractionAt,
      interactionCount: metadata.interactionCount,
      sourceType: toApiContactRequestSourceType(relationship.sourceType),
      targetPersona: {
        id: relationship.targetPersona.id,
        username: relationship.targetPersona.username,
        publicUrl: relationship.targetPersona.publicUrl,
        fullName: relationship.targetPersona.fullName,
        jobTitle: relationship.targetPersona.jobTitle,
        companyName: relationship.targetPersona.companyName,
        tagline: relationship.targetPersona.tagline,
        profilePhotoUrl: relationship.targetPersona.profilePhotoUrl,
        accessMode: toApiAccessMode(relationship.targetPersona.accessMode),
      },
      memory: {
        metAt: timeline.metAt,
        sourceLabel,
        note: relationship.notes ?? null,
      },
      followUpSummary,
      metadata,
      recentInteractions,
    };
  }

  private async getFollowUpSummary(userId: string, relationshipId: string) {
    if (!this.followUpsService) {
      return buildEmptyFollowUpSummary();
    }

    return this.followUpsService.getFollowUpSummaryForRelationship(
      userId,
      relationshipId,
    );
  }

  private async getFollowUpSummaries(userId: string, relationshipIds: string[]) {
    if (!this.followUpsService || relationshipIds.length === 0) {
      return new Map<string, RelationshipFollowUpSummary>();
    }

    const followUpsService = this.followUpsService;

    if (
      typeof followUpsService.getFollowUpSummariesForRelationships === "function"
    ) {
      return followUpsService.getFollowUpSummariesForRelationships(
        userId,
        relationshipIds,
      );
    }

    const summaries = await Promise.all(
      relationshipIds.map(async (relationshipId) => [
        relationshipId,
        await followUpsService.getFollowUpSummaryForRelationship(
          userId,
          relationshipId,
        ),
      ] as const),
    );

    return new Map(summaries);
  }

  private async getRecentInteractionsForDetail(
    userId: string,
    relationshipId: string,
    now: Date,
  ): Promise<ContactDetailRecentInteraction[]> {
    if (typeof this.relationshipsService.getRecentInteractions !== "function") {
      return [];
    }

    const recentInteractions = await this.relationshipsService.getRecentInteractions(
      relationshipId,
      CONTACT_DETAIL_RECENT_INTERACTIONS_LIMIT,
      this.prismaService,
    );

    return recentInteractions.flatMap((interaction: RecentRelationshipInteraction) => {
      const safeCreatedAt = this.getSafeLastInteractionAt(
        interaction.createdAt,
        now,
      );

      if (!safeCreatedAt) {
        return [];
      }

      return [
        {
          id: interaction.id,
          type: interaction.type,
          createdAt: safeCreatedAt,
          direction:
            interaction.senderUserId === userId ? "sent" : "received",
        },
      ];
    });
  }

  private buildRelationshipMetadata(
    relationship: Pick<
      ContactListRelationshipRecord,
      "createdAt" | "connectedAt" | "lastInteractionAt" | "interactionCount"
    >,
    now: Date,
  ): RelationshipMetadata {
    const connectedAt = this.getSafeConnectedAt(
      relationship.connectedAt,
      relationship.createdAt,
      now,
    );
    const lastInteractionAt = this.getSafeLastInteractionAt(
      relationship.lastInteractionAt,
      now,
    );
    const interactionCount = toSafeInteractionCount(
      relationship.interactionCount,
    );
    const hasInteractions = interactionCount > 0 || lastInteractionAt !== null;

    return {
      lastInteractionAt,
      interactionCount,
      hasInteractions,
      isRecentlyActive: this.isRecentlyActive(lastInteractionAt, now),
      relationshipAgeDays: this.getRelationshipAgeDays(connectedAt, now),
    };
  }

  private buildRelationshipDetailMetadata(
    relationship: Pick<
      ContactDetailRelationshipRecord,
      "createdAt" | "connectedAt" | "lastInteractionAt" | "interactionCount"
    >,
    now: Date,
  ): RelationshipMetadata {
    return this.buildRelationshipMetadata(relationship, now);
  }

  private buildRelationshipTimeline(
    relationship: {
      createdAt: Date;
      connectedAt?: Date | null;
      metAt?: Date | null;
      connectionSource?: PrismaRelationshipConnectionSource | null;
      contextLabel?: string | null;
      sourceType: PrismaContactRequestSourceType;
      connectionContext: Prisma.JsonValue | null;
      memories: Array<{
        contextLabel: string;
        metAt: Date;
        sourceLabel: string | null;
      }>;
    },
  ): RelationshipTimeline {
    const memory = relationship.memories[0];
    const storedContext = parseConnectionContext(
      relationship.connectionContext,
    );
    const connectedAt = this.getTimelineDate(
      relationship.connectedAt,
      relationship.createdAt,
      new Date(0),
    );
    const connectionSource =
      relationship.connectionSource ??
      toRelationshipConnectionSource(relationship.sourceType);

    return {
      connectedAt,
      metAt: this.getTimelineDate(
        relationship.metAt,
        memory?.metAt,
        connectedAt,
      ),
      connectionSource,
      contextLabel:
        normalizeContextLabel(relationship.contextLabel) ??
        normalizeContextLabel(memory?.contextLabel) ??
        normalizeStoredContextLabel(
          storedContext?.label,
          relationship.sourceType,
        ),
    };
  }

  private isRecentlyActive(lastInteractionAt: Date | null, now: Date): boolean {
    if (lastInteractionAt === null) {
      return false;
    }

    return (
      now.getTime() - lastInteractionAt.getTime() <= recentActivityWindowMs()
    );
  }

  private getRelationshipAgeDays(
    connectedAt: Date | null | undefined,
    now: Date,
  ): number {
    if (!(connectedAt instanceof Date)) {
      return 0;
    }

    const connectedAtMs = connectedAt.getTime();

    if (Number.isNaN(connectedAtMs) || connectedAtMs > now.getTime()) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((now.getTime() - connectedAtMs) / MILLISECONDS_PER_DAY),
    );
  }

  private getSafeConnectedAt(
    connectedAt: Date | null | undefined,
    createdAt: Date | null | undefined,
    now: Date,
  ): Date {
    const resolvedConnectedAt = this.getTimelineDate(connectedAt, createdAt);

    return resolvedConnectedAt.getTime() > now.getTime()
      ? this.getTimelineDate(createdAt, new Date(0))
      : resolvedConnectedAt;
  }

  private getTimelineDate(...candidates: Array<Date | null | undefined>): Date {
    for (const candidate of candidates) {
      if (!(candidate instanceof Date)) {
        continue;
      }

      const timestamp = candidate.getTime();

      if (!Number.isNaN(timestamp)) {
        return candidate;
      }
    }

    return new Date(0);
  }

  private getSafeLastInteractionAt(
    lastInteractionAt: Date | null | undefined,
    now: Date,
  ): Date | null {
    if (!(lastInteractionAt instanceof Date)) {
      return null;
    }

    const lastInteractionAtMs = lastInteractionAt.getTime();

    if (
      Number.isNaN(lastInteractionAtMs) ||
      lastInteractionAtMs > now.getTime()
    ) {
      return null;
    }

    return lastInteractionAt;
  }

  private buildMemorySourceLabel(
    relationship: {
      sourceType: PrismaContactRequestSourceType;
      memories: Array<{
        sourceLabel: string | null;
      }>;
    },
  ) {
    const memory = relationship.memories[0];

    return (
      normalizeContextLabel(memory?.sourceLabel) ??
      toSourceLabel(relationship.sourceType) ??
      "Profile"
    );
  }
}

function toPrismaContactRequestSourceType(
  sourceType: ContactRequestSourceType,
): PrismaContactRequestSourceType {
  switch (sourceType) {
    case ContactRequestSourceType.Profile:
      return PrismaContactRequestSourceType.PROFILE;
    case ContactRequestSourceType.Qr:
      return PrismaContactRequestSourceType.QR;
    case ContactRequestSourceType.Event:
      return PrismaContactRequestSourceType.EVENT;
  }

  throw new Error("Unsupported contact request source type");
}

function toApiContactRequestSourceType(
  sourceType: PrismaContactRequestSourceType,
): ContactRequestSourceType {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return ContactRequestSourceType.Profile;
    case PrismaContactRequestSourceType.QR:
      return ContactRequestSourceType.Qr;
    case PrismaContactRequestSourceType.EVENT:
      return ContactRequestSourceType.Event;
  }

  throw new Error("Unsupported contact request source type");
}

function toApiRelationshipConnectionSource(
  connectionSource: PrismaRelationshipConnectionSource,
): "qr" | "event" | "manual" | "unknown" {
  switch (connectionSource) {
    case PrismaRelationshipConnectionSource.QR:
      return "qr";
    case PrismaRelationshipConnectionSource.EVENT:
      return "event";
    case PrismaRelationshipConnectionSource.MANUAL:
      return "manual";
    case PrismaRelationshipConnectionSource.UNKNOWN:
    default:
      return "unknown";
  }
}

function toApiRelationshipState(
  state: PrismaContactRelationshipState,
): "approved" | "instant_access" | "expired" {
  switch (state) {
    case PrismaContactRelationshipState.INSTANT_ACCESS:
      return "instant_access";
    case PrismaContactRelationshipState.APPROVED:
      return "approved";
    case PrismaContactRelationshipState.EXPIRED:
      return "expired";
  }

  throw new Error("Unsupported relationship state");
}

function toApiAccessMode(
  accessMode: PrismaPersonaAccessMode,
): PersonaAccessMode {
  switch (accessMode) {
    case PrismaPersonaAccessMode.OPEN:
      return PersonaAccessMode.Open;
    case PrismaPersonaAccessMode.REQUEST:
      return PersonaAccessMode.Request;
    case PrismaPersonaAccessMode.PRIVATE:
      return PersonaAccessMode.Private;
  }

  throw new Error("Unsupported persona access mode");
}

function toSourceLabel(
  sourceType: PrismaContactRequestSourceType,
): string | null {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return "Profile";
    case PrismaContactRequestSourceType.QR:
      return "QR";
    case PrismaContactRequestSourceType.EVENT:
      return "Event";
  }

  throw new Error("Unsupported contact request source type");
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
    default:
      return PrismaRelationshipConnectionSource.MANUAL;
  }
}

function normalizeStoredContextLabel(
  value: unknown,
  sourceType: PrismaContactRequestSourceType,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeContextLabel(value);

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue === toSourceLabel(sourceType) ? null : normalizedValue;
}

function parseConnectionContext(value: Prisma.JsonValue | null | undefined): {
  type: "profile" | "qr" | "event";
  label: string | null;
  eventId?: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const type = candidate.type;
  const label = candidate.label;
  const eventId = candidate.eventId;

  if (type !== "profile" && type !== "qr" && type !== "event") {
    return null;
  }

  return {
    type,
    label: typeof label === "string" ? label : null,
    eventId: typeof eventId === "string" ? eventId : null,
  };
}

function extractContextLabel(value: Prisma.JsonValue | null | undefined) {
  return parseConnectionContext(value)?.label ?? null;
}

function extractContextEventId(value: Prisma.JsonValue | null | undefined) {
  return parseConnectionContext(value)?.eventId ?? null;
}

function normalizeContextLabel(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toSafeInteractionCount(interactionCount: number | null | undefined) {
  if (typeof interactionCount !== "number" || interactionCount < 0) {
    return 0;
  }

  return interactionCount;
}

function recentActivityWindowMs() {
  return RECENT_ACTIVITY_WINDOW_DAYS * MILLISECONDS_PER_DAY;
}

function getRecentActivityCutoff(now: Date) {
  return new Date(now.getTime() - recentActivityWindowMs());
}

function buildEmptyFollowUpSummary() {
  return {
    hasPendingFollowUp: false,
    nextFollowUpAt: null,
    pendingFollowUpCount: 0,
    hasPassiveInactivityFollowUp: false,
    isTriggered: false,
    isOverdue: false,
    isUpcomingSoon: false,
  };
}

function compareContactListItemsByPriority(
  left: {
    priorityScore: number;
    lastInteractionAt: Date | null;
    createdAt: Date;
    relationshipId: string;
  },
  right: {
    priorityScore: number;
    lastInteractionAt: Date | null;
    createdAt: Date;
    relationshipId: string;
  },
) {
  if (right.priorityScore !== left.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }

  const leftLastInteractionAt = left.lastInteractionAt?.getTime() ?? -1;
  const rightLastInteractionAt = right.lastInteractionAt?.getTime() ?? -1;

  if (rightLastInteractionAt !== leftLastInteractionAt) {
    return rightLastInteractionAt - leftLastInteractionAt;
  }

  const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.relationshipId.localeCompare(right.relationshipId);
}
