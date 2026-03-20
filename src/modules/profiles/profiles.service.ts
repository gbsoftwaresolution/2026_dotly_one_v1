import { Injectable, NotFoundException } from "@nestjs/common";
import { PersonaAccessMode as PrismaPersonaAccessMode } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  publicPersonaSelect,
  toPublicPersonaView,
} from "../personas/persona.presenter";

@Injectable()
export class ProfilesService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPublicProfile(username: string) {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        username: username.trim().toLowerCase(),
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      select: publicPersonaSelect,
    });

    if (!persona) {
      throw new NotFoundException("Public profile not found");
    }

    return toPublicPersonaView(persona);
  }
}
