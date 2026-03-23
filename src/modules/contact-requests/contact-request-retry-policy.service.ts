import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ContactRequestStatus as PrismaContactRequestStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";

import { REQUEST_RETRY_COOLDOWN_IN_MS } from "./contact-request.shared";

@Injectable()
export class ContactRequestRetryPolicyService {
  constructor(private readonly prismaService: PrismaService) {}

  async assertCanCreateRequest(
    fromPersonaId: string,
    toPersonaId: string,
    now = new Date(),
  ): Promise<void> {
    const existingPendingRequest =
      await this.prismaService.contactRequest.findFirst({
        where: {
          fromPersonaId,
          toPersonaId,
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

    const latestRejectedRequest =
      await this.prismaService.contactRequest.findFirst({
        where: {
          fromPersonaId,
          toPersonaId,
          status: PrismaContactRequestStatus.REJECTED,
          respondedAt: {
            gte: new Date(now.getTime() - REQUEST_RETRY_COOLDOWN_IN_MS),
          },
        },
        orderBy: {
          respondedAt: "desc",
        },
        select: {
          id: true,
        },
      });

    if (latestRejectedRequest) {
      throw new ForbiddenException("Cooldown active");
    }
  }
}
