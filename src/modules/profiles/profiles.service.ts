import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "../../generated/prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { AnalyticsService } from "../analytics/analytics.service";
import { BlocksService } from "../blocks/blocks.service";
import {
  ActivationMilestonesService,
  noopActivationMilestonesService,
} from "../users/activation-milestones.service";
import {
  type PublicPersonaRecord,
  publicPersonaSelect,
} from "../personas/persona.presenter";
import {
  buildSmartCardActionState,
  canExposeVcard,
  getSharingConfigSource,
  getSafePublicContactValues,
  supportsRequestAccessFlow,
  toSafeSmartCardConfig,
} from "../personas/persona-sharing";
import {
  canonicalizePublicUrl,
  normalizePublicSlug,
} from "../personas/public-url";
import { PublicPersonaDto } from "./dto/public-persona.dto";
import { toQrLink } from "../qr/qr.presenter";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface CachedPublicProfile {
  ownerUserId: string;
  personaId: string;
  response: PublicPersonaDto;
}

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
  userId: true,
  identity: {
    select: {
      handle: true,
    },
  },
  username: true,
  fullName: true,
  isPrimary: true,
  isDefaultRouting: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
} as const;

const canonicalPublicPersonaOrderBy: Prisma.PersonaOrderByWithRelationInput[] = [
  { isDefaultRouting: "desc" },
  { isPrimary: "desc" },
  { createdAt: "asc" },
  { id: "asc" },
];

const publicProfilePersonaSelect = {
  ...publicPersonaSelect,
  qRAccessTokens: {
    where: {
      type: PrismaQrType.profile,
      status: PrismaQrStatus.active,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      id: true,
      code: true,
    },
  },
} as const;

type PublicProfilePersonaRecord = Prisma.PersonaGetPayload<{
  select: typeof publicProfilePersonaSelect;
}>;

const PUBLIC_PROFILE_CACHE_TTL_MS = 30_000;

const defaultingConfigService: Pick<ConfigService, "get"> = {
  get: <T>(_propertyPath: string, defaultValue?: T) => {
    if (defaultValue === undefined) {
      throw new Error("Config service is not configured");
    }

    return defaultValue;
  },
};

const failClosedBlocksService: Pick<BlocksService, "assertNoInteractionBlock"> =
  {
    assertNoInteractionBlock: async () => {
      throw new Error("Blocks service is not configured");
    },
  };

@Injectable()
export class ProfilesService {
  private readonly publicProfileCache = new Map<
    string,
    CacheEntry<CachedPublicProfile>
  >();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService = defaultingConfigService as ConfigService,
    private readonly blocksService: BlocksService = failClosedBlocksService as BlocksService,
    private readonly activationMilestonesService: Pick<
      ActivationMilestonesService,
      "markFirstShareCompletedForPersona"
    > = noopActivationMilestonesService,
  ) {}

  async getPublicProfile(
    publicIdentifier: string,
    tracking?: {
      viewerUserId?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    const publicProfile = await this.getCachedPublicProfile(publicIdentifier);

    if (tracking?.viewerUserId) {
      await this.blocksService.assertNoInteractionBlock(
        tracking.viewerUserId,
        publicProfile.ownerUserId,
      );
    }

    void Promise.all([
      this.analyticsService.trackProfileView({
        personaId: publicProfile.personaId,
        viewerUserId: tracking?.viewerUserId ?? null,
        idempotencyKey: tracking?.idempotencyKey ?? null,
      }),
      this.activationMilestonesService.markFirstShareCompletedForPersona(
        publicProfile.personaId,
        {
          actorUserId: tracking?.viewerUserId ?? null,
        },
      ),
    ]);

    return publicProfile.response;
  }

  async getPublicVcard(
    publicIdentifier: string,
    viewerUserId?: string | null,
  ) {
    const persona = await this.findPublicPersonaBySlug(publicIdentifier);

    if (viewerUserId) {
      await this.blocksService.assertNoInteractionBlock(
        viewerUserId,
        persona.userId,
      );
    }

    if (
      !canExposeVcard({
        sharingMode: persona.sharingMode,
        smartCardConfig: persona.smartCardConfig,
      })
    ) {
      throw new NotFoundException("Public vCard not found");
    }

    const payload = this.buildVcardPayload(persona);

    return {
      filename: this.buildSafeVcardFilename(persona),
      content: this.generateVcardString(payload),
    } satisfies PublicVcardResult;
  }

  async getRequestTarget(viewerUserId: string, publicIdentifier: string) {
    const persona = await this.findRequestTargetBySlug(publicIdentifier);

    await this.blocksService.assertNoInteractionBlock(
      viewerUserId,
      persona.userId,
    );

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

  private async getCachedPublicProfile(
    publicIdentifier: string,
  ): Promise<CachedPublicProfile> {
    const normalizedIdentifier = normalizePublicSlug(publicIdentifier);
    const cachedEntry = this.getCachedValue(
      this.publicProfileCache,
      normalizedIdentifier,
    );

    if (cachedEntry) {
      return cachedEntry;
    }

    const persona = await this.findPublicProfilePersonaBySlug(
      normalizedIdentifier,
    );
    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);
    const activeProfileQrCode =
      this.getActiveProfileQrCodeFromRecord(persona) ??
      (await this.getActiveProfileQrCode(persona.id));
    const response = PublicPersonaDto.fromRecord(persona, {
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

    const nextCachedProfile = {
      ownerUserId: persona.userId,
      personaId: persona.id,
      response,
    } satisfies CachedPublicProfile;

    this.setCachedValue(
      this.publicProfileCache,
      normalizedIdentifier,
      nextCachedProfile,
    );

    return nextCachedProfile;
  }

  private getActiveProfileQrCodeFromRecord(
    persona: {
      qRAccessTokens?: Array<{
        id: string;
        code: string;
      }>;
    },
  ): string | null {
    const activeProfileQr = persona.qRAccessTokens?.[0];

    return activeProfileQr?.code ?? activeProfileQr?.id ?? null;
  }

  private async findPublicProfilePersonaBySlug(
    slug: string,
  ): Promise<PublicProfilePersonaRecord> {
    const canonicalPersona = await this.findCanonicalPublicProfilePersona(slug);

    if (canonicalPersona) {
      return canonicalPersona;
    }

    return this.findPublicProfilePersonaByUsernameAlias(slug);
  }

  private async findCanonicalPublicProfilePersona(
    slug: string,
  ): Promise<PublicProfilePersonaRecord | null> {
    if (typeof this.prismaService.persona.findMany !== "function") {
      return null;
    }

    const personas = await this.prismaService.persona.findMany({
      where: {
        identity: {
          is: {
            handle: slug,
          },
        },
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      orderBy: canonicalPublicPersonaOrderBy,
      select: publicProfilePersonaSelect,
    });

    return (
      personas.find(
        (persona) => !this.needsSystemManagedSharingRepair(persona),
      ) ?? null
    );
  }

  private async findPublicProfilePersonaByUsernameAlias(
    username: string,
  ): Promise<PublicProfilePersonaRecord> {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        username,
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      select: publicProfilePersonaSelect,
    });

    if (!persona) {
      throw new NotFoundException("Public profile not found");
    }

    if (this.needsSystemManagedSharingRepair(persona)) {
      throw new NotFoundException("Public profile not found");
    }

    return persona;
  }

  private async findPublicPersonaBySlug(
    slug: string,
  ): Promise<PublicPersonaRecord> {
    const canonicalPersona = await this.findCanonicalPublicPersona(slug);

    if (canonicalPersona) {
      return canonicalPersona;
    }

    return this.findPublicPersonaByUsernameAlias(slug);
  }

  private async findCanonicalPublicPersona(
    slug: string,
  ): Promise<PublicPersonaRecord | null> {
    if (typeof this.prismaService.persona.findMany !== "function") {
      return null;
    }

    const personas = await this.prismaService.persona.findMany({
      where: {
        identity: {
          is: {
            handle: slug,
          },
        },
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      orderBy: canonicalPublicPersonaOrderBy,
      select: publicPersonaSelect,
    });

    return (
      personas.find(
        (persona) => !this.needsSystemManagedSharingRepair(persona),
      ) ?? null
    );
  }

  private async findPublicPersonaByUsernameAlias(
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

    if (this.needsSystemManagedSharingRepair(persona)) {
      throw new NotFoundException("Public profile not found");
    }

    return persona;
  }

  private async findRequestTargetBySlug(
    slug: string,
  ): Promise<Prisma.PersonaGetPayload<{ select: typeof authenticatedRequestTargetSelect }>> {
    const normalizedSlug = normalizePublicSlug(slug);
    const canonicalPersona =
      typeof this.prismaService.persona.findFirst === "function"
        ? await this.prismaService.persona.findFirst({
            where: {
              identity: {
                is: {
                  handle: normalizedSlug,
                },
              },
              accessMode: {
                in: [
                  PrismaPersonaAccessMode.OPEN,
                  PrismaPersonaAccessMode.REQUEST,
                ],
              },
            },
            orderBy: canonicalPublicPersonaOrderBy,
            select: authenticatedRequestTargetSelect,
          })
        : null;

    if (canonicalPersona) {
      return canonicalPersona;
    }

    const aliasPersona = await this.prismaService.persona.findFirst({
      where: {
        username: normalizedSlug,
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      select: authenticatedRequestTargetSelect,
    });

    if (!aliasPersona) {
      throw new NotFoundException("Public profile not found");
    }

    return aliasPersona;
  }

  private needsSystemManagedSharingRepair(
    persona: Pick<PublicPersonaRecord, "sharingMode" | "smartCardConfig">,
  ): boolean {
    const source = getSharingConfigSource(persona.smartCardConfig);

    if (source === "user_custom") {
      return false;
    }

    if (source === null) {
      return (
        persona.sharingMode === PrismaPersonaSharingMode.SMART_CARD &&
        toSafeSmartCardConfig(persona.smartCardConfig) === null
      );
    }

    return toSafeSmartCardConfig(persona.smartCardConfig) === null;
  }

  private getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
    const entry = cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCachedValue<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
  ) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + PUBLIC_PROFILE_CACHE_TTL_MS,
    });
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
      | "identity"
    >,
  ): PublicVcardPayload {
    const publicUrl = canonicalizePublicUrl(
      persona.publicUrl,
      persona.username,
      persona.identity?.handle,
    );
    const publicActionValues = getSafePublicContactValues({
      sharingMode: PrismaPersonaSharingMode.SMART_CARD,
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
      `N:${[payload.n.familyName, payload.n.givenName, "", "", ""]
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

    if (Buffer.byteLength(line, "utf8") <= maxLineLength) {
      return line;
    }

    const segments: string[] = [];

    let currentSegment = "";

    for (const char of Array.from(line)) {
      const candidate = `${currentSegment}${char}`;

      if (
        currentSegment.length > 0 &&
        Buffer.byteLength(candidate, "utf8") > maxLineLength
      ) {
        segments.push(
          segments.length === 0 ? currentSegment : ` ${currentSegment}`,
        );
        currentSegment = char;
        continue;
      }

      currentSegment = candidate;
    }

    if (currentSegment.length > 0) {
      segments.push(
        segments.length === 0 ? currentSegment : ` ${currentSegment}`,
      );
    }

    return segments.join("\r\n");
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
