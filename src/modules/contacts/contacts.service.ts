import { Injectable, NotFoundException } from "@nestjs/common";
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
  ) {}

  async findAll(userId: string, query: ListContactsQueryDto) {
    const relationships = await this.prismaService.contactRelationship.findMany(
      {
        where: {
          ownerUserId: userId,
          state: PrismaContactRelationshipState.APPROVED,
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
    const relationship = await this.getOwnedApprovedRelationship(
      userId,
      relationshipId,
    );

    return this.toContactDetail(relationship);
  }

  async updateNote(
    userId: string,
    relationshipId: string,
    updateContactNoteDto: UpdateContactNoteDto,
  ) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedApprovedRelationship(
        userId,
        relationshipId,
        tx,
      );

      const note = updateContactNoteDto.note;

      await this.contactMemoryService.updateNote(tx, {
        memoryId: relationship.memories[0]?.id,
        relationshipId: relationship.id,
        metAt: relationship.createdAt,
        sourceLabel:
          relationship.memories[0]?.sourceLabel ??
          toSourceLabel(relationship.sourceType),
        note,
      });

      return {
        relationshipId: relationship.id,
        note,
      };
    });
  }

  private async getOwnedApprovedRelationship(
    userId: string,
    relationshipId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const relationship = await prisma.contactRelationship.findFirst({
      where: {
        id: relationshipId,
        ownerUserId: userId,
        state: PrismaContactRelationshipState.APPROVED,
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
      targetUserId: relationship.targetUserId,
      state: toApiRelationshipState(relationship.state),
      createdAt: relationship.createdAt,
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
  }

  throw new Error("Unsupported contact request source type");
}

function toApiRelationshipState(
  state: PrismaContactRelationshipState,
): "approved" {
  switch (state) {
    case PrismaContactRelationshipState.APPROVED:
      return "approved";
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
  }

  throw new Error("Unsupported contact request source type");
}
