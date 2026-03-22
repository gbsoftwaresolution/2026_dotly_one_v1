import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PersonaAccessMode as PrismaPersonaAccessMode } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  publicPersonaSelect,
  toPublicPersonaView,
} from "../personas/persona.presenter";
import { supportsRequestAccessFlow } from "../personas/persona-sharing";

const authenticatedRequestTargetSelect = {
  id: true,
  username: true,
  fullName: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
} as const;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getPublicProfile(
    username: string,
    tracking?: {
      viewerUserId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
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

    void this.analyticsService.trackProfileView({
      personaId: persona.id,
      viewerUserId: tracking?.viewerUserId ?? null,
      idempotencyKey: tracking?.idempotencyKey ?? null,
    });

    return toPublicPersonaView(persona);
  }

  async getRequestTarget(username: string) {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        username: username.trim().toLowerCase(),
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      select: authenticatedRequestTargetSelect,
    });

    if (!persona) {
      throw new NotFoundException("Public profile not found");
    }

    if (
      !supportsRequestAccessFlow(persona.sharingMode, persona.smartCardConfig)
    ) {
      throw new ForbiddenException(
        "This profile is not accepting requests at this time.",
      );
    }

    return {
      id: persona.id,
      username: persona.username,
      fullName: persona.fullName,
      accessMode: persona.accessMode.toLowerCase(),
    };
  }
}
