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
    toPersonaId: string,
  ): Promise<{
    fromPersona: ContactRequestActorPersona;
    targetPersona: ContactRequestTargetPersona;
    senderUser: ContactRequestSenderUser;
  }> {
    const fromPersona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      fromPersonaId,
    );

    const targetPersona = await this.prismaService.persona.findUnique({
      where: {
        id: toPersonaId,
      },
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
      },
    });

    if (!senderUser) {
      throw new NotFoundException("User not found");
    }

    if (targetPersona.verifiedOnly && !senderUser.isVerified) {
      throw new ForbiddenException("Verified profiles only");
    }

    return {
      fromPersona,
      targetPersona,
      senderUser,
    };
  }
}
