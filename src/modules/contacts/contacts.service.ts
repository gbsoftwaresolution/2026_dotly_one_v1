import {
  ConflictException,
  Injectable,
  NotFoundException,
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
import { RelationshipsService } from "../relationships/relationships.service";

import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactNoteDto } from "./dto/update-contact-note.dto";

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

@Injectable()
export class ContactsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  async findAll(userId: string, query: ListContactsQueryDto) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);
    const now = new Date();
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
        },
        orderBy: {
          createdAt: "desc",
        },
        select: contactRelationshipSelect,
      },
    );

    return relationships.map((relationship) =>
      this.toContactListItem(relationship),
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

    return this.toContactDetail(normalizedRelationship);
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

  private toContactListItem(relationship: ContactRelationshipRecord) {
    const memory = relationship.memories[0];

    return {
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      createdAt: relationship.createdAt,
      accessEndAt: relationship.accessEndAt,
      lastInteractionAt: relationship.lastInteractionAt ?? null,
      interactionCount: toSafeInteractionCount(relationship.interactionCount),
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
    };
  }

  private toContactDetail(relationship: ContactRelationshipRecord) {
    const memory = relationship.memories[0];

    return {
      relationshipId: relationship.id,
      state: toApiRelationshipState(relationship.state),
      accessStartAt: relationship.accessStartAt,
      accessEndAt: relationship.accessEndAt,
      isExpired: relationship.state === PrismaContactRelationshipState.EXPIRED,
      createdAt: relationship.createdAt,
      lastInteractionAt: relationship.lastInteractionAt ?? null,
      interactionCount: toSafeInteractionCount(relationship.interactionCount),
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
    };
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
