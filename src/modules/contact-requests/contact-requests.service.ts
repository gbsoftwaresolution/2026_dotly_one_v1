import { Injectable } from "@nestjs/common";
import { ContactRequestStatus as PrismaContactRequestStatus } from "../../generated/prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";

import { ContactRequestCreateService } from "./contact-request-create.service";
import { ContactRequestRespondService } from "./contact-request-respond.service";
import {
  incomingContactRequestSelect,
  outgoingContactRequestSelect,
  toApiContactRequestSourceType,
  toApiContactRequestStatus,
} from "./contact-request.shared";
import { CreateContactRequestDto } from "./dto/create-contact-request.dto";

@Injectable()
export class ContactRequestsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly createContactRequestService: ContactRequestCreateService,
    private readonly contactRequestRespondService: ContactRequestRespondService,
  ) {}

  async create(
    userId: string,
    createContactRequestDto: CreateContactRequestDto,
  ) {
    return this.createContactRequestService.create(
      userId,
      createContactRequestDto,
    );
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
    return this.contactRequestRespondService.approve(userId, requestId);
  }

  async reject(userId: string, requestId: string) {
    return this.contactRequestRespondService.reject(userId, requestId);
  }
}
