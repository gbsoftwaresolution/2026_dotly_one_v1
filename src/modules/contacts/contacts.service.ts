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
} from "@prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { FollowUpsService } from "../follow-ups/follow-ups.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactNoteDto } from "./dto/update-contact-note.dto";

const RECENT_ACTIVITY_WINDOW_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

const contactRelationshipSelect = {
  id: true,
  ownerUserId: true,
  targetUserId: true,
  state: true,
  accessStartAt: true,
  accessEndAt: true,
  lastInteractionAt: true,
  interactionCount: true,
  createdAt: true,
  sourceType: true,
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
    select: {
      id: true,
      metAt: true,
      sourceLabel: true,
      note: true,
    },
  },
} satisfies Prisma.ContactRelationshipSelect;

type ContactRelationshipRecord = Prisma.ContactRelationshipGetPayload<{
  select: typeof contactRelationshipSelect;
}>;

type RelationshipMetadata = {
  lastInteractionAt: Date | null;
  interactionCount: number;
  hasInteractions: boolean;
  isRecentlyActive: boolean;
  relationshipAgeDays: number;
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
        orderBy: {
          createdAt: "desc",
        },
        select: contactRelationshipSelect,
      },
    );

    return relationships.map((relationship) =>
      this.toContactListItem(relationship, now),
    );
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

    return this.toContactDetail(
      normalizedRelationship,
      new Date(),
      await this.getFollowUpSummary(userId, normalizedRelationship.id),
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
      const existingNote = normalizedRelationship.memories[0]?.note ?? null;

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

      await this.contactMemoryService.updateNote(tx, {
        memoryId: normalizedRelationship.memories[0]?.id,
        relationshipId: normalizedRelationship.id,
        metAt:
          normalizedRelationship.memories[0]?.metAt ??
          normalizedRelationship.accessStartAt ??
          normalizedRelationship.createdAt,
        sourceLabel:
          normalizedRelationship.memories[0]?.sourceLabel ??
          toSourceLabel(normalizedRelationship.sourceType),
        note,
      });

      const interactionMetadata =
        await this.relationshipsService.updateInteractionMetadata(
          tx,
          normalizedRelationship.id,
        );

      return {
        relationshipId: normalizedRelationship.id,
        note,
        lastInteractionAt:
          interactionMetadata?.lastInteractionAt ??
          normalizedRelationship.lastInteractionAt ??
          null,
        interactionCount:
          interactionMetadata?.interactionCount ??
          toSafeInteractionCount(normalizedRelationship.interactionCount),
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
      select: contactRelationshipSelect,
    });

    if (!relationship) {
      throw new NotFoundException("Contact not found");
    }

    return relationship;
  }

  private toContactListItem(
    relationship: ContactRelationshipRecord,
    now: Date,
  ) {
    const memory = relationship.memories[0];
    const metadata = this.buildRelationshipMetadata(relationship, now);

    return {
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      createdAt: relationship.createdAt,
      accessEndAt: relationship.accessEndAt,
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
      },
      memory: {
        metAt: memory?.metAt ?? relationship.createdAt,
        sourceLabel:
          memory?.sourceLabel ?? toSourceLabel(relationship.sourceType),
        note: memory?.note ?? null,
      },
      metadata,
    };
  }

  private toContactDetail(
    relationship: ContactRelationshipRecord,
    now: Date,
    followUpSummary: {
      hasPendingFollowUp: boolean;
      nextFollowUpAt: Date | null;
      pendingFollowUpCount: number;
      isTriggered: boolean;
      isOverdue: boolean;
      isUpcomingSoon: boolean;
    },
  ) {
    const memory = relationship.memories[0];
    const metadata = this.buildRelationshipDetailMetadata(relationship, now);

    return {
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      accessStartAt: relationship.accessStartAt,
      accessEndAt: relationship.accessEndAt,
      isExpired: relationship.state === PrismaContactRelationshipState.EXPIRED,
      createdAt: relationship.createdAt,
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
        metAt: memory?.metAt ?? relationship.createdAt,
        sourceLabel:
          memory?.sourceLabel ?? toSourceLabel(relationship.sourceType),
        note: memory?.note ?? null,
      },
      followUpSummary,
      metadata,
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

  private buildRelationshipMetadata(
    relationship: Pick<
      ContactRelationshipRecord,
      "createdAt" | "lastInteractionAt" | "interactionCount"
    >,
    now: Date,
  ): RelationshipMetadata {
    const lastInteractionAt = this.getSafeLastInteractionAt(
      relationship.lastInteractionAt,
      now,
    );
    const interactionCount = toSafeInteractionCount(relationship.interactionCount);
    const hasInteractions = interactionCount > 0 || lastInteractionAt !== null;

    return {
      lastInteractionAt,
      interactionCount,
      hasInteractions,
      isRecentlyActive: this.isRecentlyActive(lastInteractionAt, now),
      relationshipAgeDays: this.getRelationshipAgeDays(relationship.createdAt, now),
    };
  }

  private buildRelationshipDetailMetadata(
    relationship: Pick<
      ContactRelationshipRecord,
      "createdAt" | "lastInteractionAt" | "interactionCount"
    >,
    now: Date,
  ): RelationshipMetadata {
    return this.buildRelationshipMetadata(relationship, now);
  }

  private isRecentlyActive(lastInteractionAt: Date | null, now: Date): boolean {
    if (lastInteractionAt === null) {
      return false;
    }

    return now.getTime() - lastInteractionAt.getTime() <= recentActivityWindowMs();
  }

  private getRelationshipAgeDays(createdAt: Date | null | undefined, now: Date): number {
    if (!(createdAt instanceof Date)) {
      return 0;
    }

    const createdAtMs = createdAt.getTime();

    if (Number.isNaN(createdAtMs)) {
      return 0;
    }

    return Math.max(0, Math.floor((now.getTime() - createdAtMs) / MILLISECONDS_PER_DAY));
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
    isTriggered: false,
    isOverdue: false,
    isUpcomingSoon: false,
  };
}
