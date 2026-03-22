import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  publicPersonaSelect,
} from "../personas/persona.presenter";
import {
  buildSmartCardActionState,
  supportsRequestAccessFlow,
  toSafeSmartCardConfig,
} from "../personas/persona-sharing";
import { PublicPersonaDto } from "./dto/public-persona.dto";
import { toQrLink } from "../qr/qr.presenter";

const authenticatedRequestTargetSelect = {
  id: true,
  username: true,
  fullName: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
} as const;

const noopConfigService: Pick<ConfigService, "get"> = {
  get: <T>(propertyPath: string, defaultValue?: T) => defaultValue as T,
};

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: Pick<ConfigService, "get"> =
      noopConfigService,
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

    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);
    const activeProfileQrCode = await this.getActiveProfileQrCode(persona.id);

    void this.analyticsService.trackProfileView({
      personaId: persona.id,
      viewerUserId: tracking?.viewerUserId ?? null,
      idempotencyKey: tracking?.idempotencyKey ?? null,
    });

    return PublicPersonaDto.fromRecord(persona, {
      instantConnectUrl: this.getInstantConnectUrl(
        safeSmartCardConfig,
        activeProfileQrCode,
      ),
      actionState: buildSmartCardActionState(
        {
          sharingMode: persona.sharingMode,
          accessMode: persona.accessMode,
          hasActiveProfileQr: activeProfileQrCode !== null,
        },
        safeSmartCardConfig,
      ),
    });
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

    const hasActiveProfileQr = await this.hasActiveProfileQr(persona.id);

    if (
      !supportsRequestAccessFlow(persona.sharingMode, persona.smartCardConfig, {
        hasActiveProfileQr,
      })
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

  private async hasActiveProfileQr(personaId: string): Promise<boolean> {
    const activeProfileQrCode = await this.getActiveProfileQrCode(personaId);

    return activeProfileQrCode !== null;
  }

  private async getActiveProfileQrCode(
    personaId: string,
  ): Promise<string | null> {
    const activeProfileQr = await this.prismaService.qRAccessToken?.findFirst({
      where: {
        personaId,
        type: PrismaQrType.profile,
        status: PrismaQrStatus.active,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        code: true,
      },
    });

    return activeProfileQr?.code ?? activeProfileQr?.id ?? null;
  }

  private getInstantConnectUrl(
    smartCardConfig: ReturnType<typeof toSafeSmartCardConfig>,
    activeProfileQrCode: string | null,
  ): string | null {
    if (
      smartCardConfig?.primaryAction !==
        PersonaSmartCardPrimaryAction.InstantConnect ||
      activeProfileQrCode === null
    ) {
      return null;
    }

    const baseUrl = this.configService.get<string>(
      "qr.baseUrl",
      "https://dotly.id/q",
    );

    return toQrLink(baseUrl, activeProfileQrCode);
  }
}
