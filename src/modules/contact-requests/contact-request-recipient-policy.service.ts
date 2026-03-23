import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PersonaAccessMode as PrismaPersonaAccessMode } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { PersonasService } from "../personas/personas.service";
import { userHasActiveTrustFactor } from "../auth/verification-policy.service";

import {
  ContactRequestActorPersona,
  ContactRequestSenderUser,
  ContactRequestTargetPersona,
} from "./contact-request-create.types";

@Injectable()
export class ContactRequestRecipientPolicyService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly personasService: PersonasService,
    private readonly blocksService: BlocksService,
  ) {}

  async resolveEligibleParticipants(
    userId: string,
    fromPersonaId: string,
    target: {
      toPersonaId?: string | null;
      toUsername?: string | null;
    },
  ): Promise<{
    fromPersona: ContactRequestActorPersona;
    targetPersona: ContactRequestTargetPersona;
    senderUser: ContactRequestSenderUser;
  }> {
    const targetPersonaWhere = this.buildTargetPersonaWhere(target);
    const fromPersona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      fromPersonaId,
    );

    const targetPersona = await this.prismaService.persona.findFirst({
      where: targetPersonaWhere,
      select: {
        id: true,
        userId: true,
        username: true,
        fullName: true,
        accessMode: true,
        sharingMode: true,
        smartCardConfig: true,
        verifiedOnly: true,
      },
    });

    if (!targetPersona) {
      throw new NotFoundException("Target persona not found");
    }

    if (targetPersona.userId === userId) {
      throw new BadRequestException(
        "You cannot send a contact request to your own persona",
      );
    }

    if (targetPersona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      throw new ForbiddenException("Cannot request private profile");
    }

    await this.blocksService.assertNoInteractionBlock(
      userId,
      targetPersona.userId,
    );

    const senderUser = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isVerified: true,
        phoneVerifiedAt: true,
      },
    });

    if (!senderUser) {
      throw new NotFoundException("User not found");
    }

    if (targetPersona.verifiedOnly && !userHasActiveTrustFactor(senderUser)) {
      throw new ForbiddenException("Verified profiles only");
    }

    return {
      fromPersona,
      targetPersona,
      senderUser,
    };
  }

  private buildTargetPersonaWhere(target: {
    toPersonaId?: string | null;
    toUsername?: string | null;
  }) {
    if (target.toPersonaId && target.toUsername) {
      throw new BadRequestException(
        "Provide only one target: toPersonaId or toUsername",
      );
    }

    if (target.toPersonaId) {
      return {
        id: target.toPersonaId,
      };
    }

    if (target.toUsername) {
      return {
        username: target.toUsername,
      };
    }

    throw new BadRequestException(
      "Provide either toPersonaId or toUsername when sending a contact request",
    );
  }
}
