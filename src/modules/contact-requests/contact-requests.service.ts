import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRequestSourceType as PrismaContactRequestSourceType,
  ContactRequestStatus as PrismaContactRequestStatus,
  PersonaAccessMode as PrismaPersonaAccessMode,
  Prisma,
} from "@prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { ContactRequestStatus } from "../../common/enums/contact-request-status.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { PersonasService } from "../personas/personas.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { CreateContactRequestDto } from "./dto/create-contact-request.dto";

const incomingContactRequestSelect = {
  id: true,
  createdAt: true,
  reason: true,
  sourceType: true,
  fromPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

const outgoingContactRequestSelect = {
  id: true,
  createdAt: true,
  status: true,
  reason: true,
  toPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
      jobTitle: true,
      companyName: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

const sendContactRequestSelect = {
  id: true,
  status: true,
  createdAt: true,
  toPersona: {
    select: {
      id: true,
      username: true,
      fullName: true,
    },
  },
} satisfies Prisma.ContactRequestSelect;

@Injectable()
export class ContactRequestsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly personasService: PersonasService,
    private readonly blocksService: BlocksService,
    private readonly relationshipsService: RelationshipsService,
    private readonly contactMemoryService: ContactMemoryService,
  ) {}

  async create(
    userId: string,
    createContactRequestDto: CreateContactRequestDto,
  ) {
    const fromPersona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      createContactRequestDto.fromPersonaId,
    );

    const targetPersona = await this.prismaService.persona.findUnique({
      where: {
        id: createContactRequestDto.toPersonaId,
      },
      select: {
        id: true,
        userId: true,
        username: true,
        fullName: true,
        accessMode: true,
      },
    });

    if (!targetPersona) {
      throw new NotFoundException("Target persona not found");
    }

    if (targetPersona.userId === userId) {
      throw new ConflictException(
        "You cannot send a contact request to your own persona",
      );
    }

    if (targetPersona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      throw new ForbiddenException("Target persona is private");
    }

    const isBlocked = await this.blocksService.isBlockedByUser(
      targetPersona.userId,
      userId,
    );

    if (isBlocked) {
      throw new ForbiddenException(
        "You cannot send a contact request to this persona",
      );
    }

    const existingPendingRequest =
      await this.prismaService.contactRequest.findFirst({
        where: {
          fromPersonaId: fromPersona.id,
          toPersonaId: targetPersona.id,
          status: PrismaContactRequestStatus.PENDING,
        },
        select: {
          id: true,
        },
      });

    if (existingPendingRequest) {
      throw new ConflictException(
        "A pending contact request already exists for this persona",
      );
    }

    const reason = createContactRequestDto.reason ?? null;

    try {
      const contactRequest = await this.prismaService.contactRequest.create({
        data: {
          fromUserId: userId,
          toUserId: targetPersona.userId,
          fromPersonaId: fromPersona.id,
          toPersonaId: targetPersona.id,
          reason,
          sourceType: toPrismaContactRequestSourceType(
            createContactRequestDto.sourceType,
          ),
          sourceId: createContactRequestDto.sourceId ?? null,
          status: PrismaContactRequestStatus.PENDING,
        },
        select: sendContactRequestSelect,
      });

      return {
        id: contactRequest.id,
        status: toApiContactRequestStatus(contactRequest.status),
        createdAt: contactRequest.createdAt,
        toPersona: contactRequest.toPersona,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A pending contact request already exists for this persona",
        );
      }

      throw error;
    }
  }

  async findIncoming(userId: string) {
    const requests = await this.prismaService.contactRequest.findMany({
      where: {
        toUserId: userId,
        status: PrismaContactRequestStatus.PENDING,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: incomingContactRequestSelect,
    });

    return requests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      reason: request.reason,
      sourceType: toApiContactRequestSourceType(request.sourceType),
      fromPersona: request.fromPersona,
    }));
  }

  async findOutgoing(userId: string) {
    const requests = await this.prismaService.contactRequest.findMany({
      where: {
        fromUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: outgoingContactRequestSelect,
    });

    return requests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      status: toApiContactRequestStatus(request.status),
      reason: request.reason,
      toPersona: request.toPersona,
    }));
  }

  async approve(userId: string, requestId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.findUnique({
        where: {
          id: requestId,
        },
        select: {
          id: true,
          status: true,
          fromUserId: true,
          toUserId: true,
          fromPersonaId: true,
          toPersonaId: true,
          sourceType: true,
          sourceId: true,
        },
      });

      if (!contactRequest) {
        throw new NotFoundException("Contact request not found");
      }

      if (contactRequest.toUserId !== userId) {
        throw new ForbiddenException(
          "You are not allowed to approve this contact request",
        );
      }

      if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      const respondedAt = new Date();
      const updateResult = await tx.contactRequest.updateMany({
        where: {
          id: contactRequest.id,
          toUserId: userId,
          status: PrismaContactRequestStatus.PENDING,
        },
        data: {
          status: PrismaContactRequestStatus.APPROVED,
          respondedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      const relationship =
        await this.relationshipsService.createApprovedRelationship(tx, {
          ownerUserId: contactRequest.toUserId,
          targetUserId: contactRequest.fromUserId,
          ownerPersonaId: contactRequest.toPersonaId,
          targetPersonaId: contactRequest.fromPersonaId,
          sourceType: contactRequest.sourceType,
          sourceId: contactRequest.sourceId,
        });

      await this.contactMemoryService.createInitialMemory(tx, {
        relationshipId: relationship.id,
        metAt: respondedAt,
        sourceLabel: toSourceLabel(contactRequest.sourceType),
      });

      return {
        requestId: contactRequest.id,
        status: ContactRequestStatus.Approved,
        relationshipId: relationship.id,
      };
    });
  }

  async reject(userId: string, requestId: string) {
    const contactRequest = await this.prismaService.contactRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        toUserId: true,
        status: true,
      },
    });

    if (!contactRequest) {
      throw new NotFoundException("Contact request not found");
    }

    if (contactRequest.toUserId !== userId) {
      throw new ForbiddenException(
        "You are not allowed to reject this contact request",
      );
    }

    if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    const respondedAt = new Date();
    const updateResult = await this.prismaService.contactRequest.updateMany({
      where: {
        id: contactRequest.id,
        toUserId: userId,
        status: PrismaContactRequestStatus.PENDING,
      },
      data: {
        status: PrismaContactRequestStatus.REJECTED,
        respondedAt,
      },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    return {
      requestId: contactRequest.id,
      status: ContactRequestStatus.Rejected,
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

function toApiContactRequestStatus(
  status: PrismaContactRequestStatus,
): ContactRequestStatus {
  switch (status) {
    case PrismaContactRequestStatus.PENDING:
      return ContactRequestStatus.Pending;
    case PrismaContactRequestStatus.APPROVED:
      return ContactRequestStatus.Approved;
    case PrismaContactRequestStatus.REJECTED:
      return ContactRequestStatus.Rejected;
    case PrismaContactRequestStatus.EXPIRED:
      return ContactRequestStatus.Expired;
    case PrismaContactRequestStatus.CANCELLED:
      return ContactRequestStatus.Cancelled;
  }

  throw new Error("Unsupported contact request status");
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
