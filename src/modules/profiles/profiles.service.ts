import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  type PublicPersonaRecord,
  publicPersonaSelect,
} from "../personas/persona.presenter";
import {
  buildSmartCardActionState,
  buildSafePublicActionValues,
  isEmailLikeValue,
  isPhoneLikeValue,
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
    const persona = await this.findPublicPersonaByUsername(username);

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
        {
          publicPhone: persona.publicPhone,
          publicWhatsappNumber: persona.publicWhatsappNumber,
          publicEmail: persona.publicEmail,
        },
      ),
    });
  }

  async getPublicVcard(username: string) {
    const persona = await this.findPublicPersonaByUsername(username);
    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);

    if (
      persona.sharingMode !== PrismaPersonaSharingMode.SMART_CARD ||
      !safeSmartCardConfig?.allowVcard
    ) {
      throw new NotFoundException("Public vCard not found");
    }

    this.assertNoMalformedPublicActionValues(persona, safeSmartCardConfig);

    return {
      filename: `${persona.username.trim().toLowerCase()}.vcf`,
      content: this.buildVcardContent(persona, safeSmartCardConfig),
    };
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

  private async findPublicPersonaByUsername(
    username: string,
  ): Promise<PublicPersonaRecord> {
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

    return persona;
  }

  private assertNoMalformedPublicActionValues(
    persona: Pick<
      PublicPersonaRecord,
      "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
    safeSmartCardConfig: NonNullable<ReturnType<typeof toSafeSmartCardConfig>>,
  ): void {
    const malformedFields: string[] = [];

    if (
      safeSmartCardConfig.allowCall &&
      persona.publicPhone !== null &&
      !isPhoneLikeValue(persona.publicPhone)
    ) {
      malformedFields.push("publicPhone");
    }

    if (
      safeSmartCardConfig.allowWhatsapp &&
      persona.publicWhatsappNumber !== null &&
      !isPhoneLikeValue(persona.publicWhatsappNumber)
    ) {
      malformedFields.push("publicWhatsappNumber");
    }

    if (
      safeSmartCardConfig.allowEmail &&
      persona.publicEmail !== null &&
      !isEmailLikeValue(persona.publicEmail)
    ) {
      malformedFields.push("publicEmail");
    }

    if (malformedFields.length > 0) {
      throw new BadRequestException(
        `Malformed public action values: ${malformedFields.join(", ")}`,
      );
    }
  }

  private buildVcardContent(
    persona: Pick<
      PublicPersonaRecord,
      | "username"
      | "publicUrl"
      | "fullName"
      | "jobTitle"
      | "companyName"
      | "tagline"
      | "publicPhone"
      | "publicWhatsappNumber"
      | "publicEmail"
    >,
    safeSmartCardConfig: NonNullable<ReturnType<typeof toSafeSmartCardConfig>>,
  ): string {
    const publicUrl = this.toCanonicalPublicUrl(persona.publicUrl, persona.username);
    const publicActionValues = buildSafePublicActionValues({
      smartCardConfig: safeSmartCardConfig,
      publicPhone: persona.publicPhone,
      publicWhatsappNumber: persona.publicWhatsappNumber,
      publicEmail: persona.publicEmail,
    });
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${this.escapeVcardText(persona.fullName)}`,
      `URL:${this.escapeVcardText(publicUrl)}`,
    ];

    if (persona.jobTitle.trim().length > 0) {
      lines.push(`TITLE:${this.escapeVcardText(persona.jobTitle)}`);
    }

    if (persona.companyName.trim().length > 0) {
      lines.push(`ORG:${this.escapeVcardText(persona.companyName)}`);
    }

    if (publicActionValues.email !== null) {
      lines.push(`EMAIL:${this.escapeVcardText(publicActionValues.email)}`);
    }

    if (publicActionValues.phone !== null) {
      lines.push(`TEL:${this.escapeVcardText(publicActionValues.phone)}`);
    }

    if (persona.tagline.trim().length > 0) {
      lines.push(`NOTE:${this.escapeVcardText(persona.tagline)}`);
    }

    lines.push("END:VCARD");

    return `${lines.join("\r\n")}\r\n`;
  }

  private escapeVcardText(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  private toCanonicalPublicUrl(publicUrl: string, username: string): string {
    const trimmedPublicUrl = publicUrl.trim();

    if (
      trimmedPublicUrl.startsWith("http://") ||
      trimmedPublicUrl.startsWith("https://")
    ) {
      return trimmedPublicUrl;
    }

    if (trimmedPublicUrl.length > 0) {
      return `https://${trimmedPublicUrl.replace(/^\/+/, "")}`;
    }

    return `https://dotly.id/${username}`;
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
