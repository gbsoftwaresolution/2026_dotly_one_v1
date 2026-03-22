import {
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
  supportsRequestAccessFlow,
  toSafeSmartCardConfig,
} from "../personas/persona-sharing";
import { PublicPersonaDto } from "./dto/public-persona.dto";
import { toQrLink } from "../qr/qr.presenter";

interface PublicVcardPayload {
  fn: string;
  n: {
    familyName: string;
    givenName: string;
  };
  title: string | null;
  org: string | null;
  email: string | null;
  tel: string | null;
  url: string;
  note: string | null;
}

interface PublicVcardResult {
  filename: string;
  content: string;
}

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

    if (!this.canExposeVcard(persona)) {
      throw new NotFoundException("Public vCard not found");
    }

    const payload = this.buildVcardPayload(persona);

    return {
      filename: this.buildSafeVcardFilename(persona),
      content: this.generateVcardString(payload),
    } satisfies PublicVcardResult;
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

  private canExposeVcard(
    persona: Pick<PublicPersonaRecord, "sharingMode" | "smartCardConfig">,
  ): boolean {
    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);

    return Boolean(
      persona.sharingMode === PrismaPersonaSharingMode.SMART_CARD &&
        safeSmartCardConfig?.allowVcard,
    );
  }

  private buildVcardPayload(
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
      | "smartCardConfig"
    >,
  ): PublicVcardPayload {
    const publicUrl = this.toCanonicalPublicUrl(persona.publicUrl, persona.username);
    const publicActionValues = buildSafePublicActionValues({
      smartCardConfig: persona.smartCardConfig,
      publicPhone: persona.publicPhone,
      publicWhatsappNumber: persona.publicWhatsappNumber,
      publicEmail: persona.publicEmail,
    });
    const fn =
      this.getTrimmedText(persona.fullName) ??
      this.getTrimmedText(persona.username) ??
      "Dotly Contact";
    const [givenName, familyName] = this.splitVcardName(fn);

    return {
      fn,
      n: {
        familyName,
        givenName,
      },
      title: this.getTrimmedText(persona.jobTitle),
      org: this.getTrimmedText(persona.companyName),
      email: publicActionValues.email,
      tel: publicActionValues.phone,
      url: publicUrl,
      note: this.getTrimmedText(persona.tagline),
    } satisfies PublicVcardPayload;
  }

  private generateVcardString(payload: PublicVcardPayload): string {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${this.escapeVcardText(payload.fn)}`,
      `N:${[
        payload.n.familyName,
        payload.n.givenName,
        "",
        "",
        "",
      ]
        .map((value) => this.escapeVcardText(value))
        .join(";")}`,
    ];

    if (payload.title !== null) {
      lines.push(`TITLE:${this.escapeVcardText(payload.title)}`);
    }

    if (payload.org !== null) {
      lines.push(`ORG:${this.escapeVcardText(payload.org)}`);
    }

    if (payload.email !== null) {
      lines.push(`EMAIL:${this.escapeVcardText(payload.email)}`);
    }

    if (payload.tel !== null) {
      lines.push(`TEL:${this.escapeVcardText(payload.tel)}`);
    }

    lines.push(`URL:${this.escapeVcardText(payload.url)}`);

    if (payload.note !== null) {
      lines.push(`NOTE:${this.escapeVcardText(payload.note)}`);
    }

    lines.push("END:VCARD");

    return `${lines.map((line) => this.foldVcardLine(line)).join("\r\n")}\r\n`;
  }

  private buildSafeVcardFilename(
    persona: Pick<PublicPersonaRecord, "username" | "fullName">,
  ): string {
    const rawBase =
      this.getTrimmedText(persona.username) ??
      this.getTrimmedText(persona.fullName) ??
      "contact";
    const safeBase = rawBase
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);

    return `${safeBase || "contact"}.vcf`;
  }

  private escapeVcardText(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  private getTrimmedText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private splitVcardName(fullName: string): [string, string] {
    const parts = fullName.split(/\s+/).filter((part) => part.length > 0);

    if (parts.length <= 1) {
      return [fullName, ""];
    }

    const familyName = parts.at(-1) ?? fullName;
    const givenName = parts.slice(0, -1).join(" ");

    return [givenName, familyName];
  }

  private foldVcardLine(line: string): string {
    const maxLineLength = 75;

    if (line.length <= maxLineLength) {
      return line;
    }

    const segments: string[] = [];

    for (let index = 0; index < line.length; index += maxLineLength) {
      const segment = line.slice(index, index + maxLineLength);

      segments.push(index === 0 ? segment : ` ${segment}`);
    }

    return segments.join("\r\n");
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
