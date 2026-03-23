import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaType as PrismaPersonaType,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "@prisma/client";
import { randomBytes } from "crypto";

import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";

import { CreatePersonaDto } from "./dto/create-persona.dto";
import { UpdatePersonaSharingDto } from "./dto/update-persona-sharing.dto";
import { UpdatePersonaDto } from "./dto/update-persona.dto";
import {
  privatePersonaSelect,
  type PrivatePersonaRecord,
  type PrivatePersonaSharingCapabilities,
  toPrismaAccessMode,
  toPrismaPersonaType,
  toPrivatePersonaView,
} from "./persona.presenter";
import { buildPublicUrl } from "./public-url";
import {
  getSharingConfigSource,
  type PersonaSharingConfigSource,
  type PersonaSmartCardConfig,
  type PersonaPublicActionFields,
  normalizePublicEmailField,
  normalizePublicPhoneField,
  toApiSharingMode,
  toSafeSmartCardConfig,
  toStoredSmartCardConfig,
  toPrismaSharingMode,
  validateSmartCardConfig,
  validateSmartCardConfigCompatibility,
} from "./persona-sharing";
import {
  buildPublicPersonaTrustSignals,
  buildStoredPersonaTrustState,
} from "./persona-trust";

interface PersonaSmartDefaultsTarget {
  id: string;
  type: PrismaPersonaType;
  accessMode: PrismaPersonaAccessMode;
  fullName: string;
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
  smartCardConfig?: unknown;
}

interface PersonaSmartDefaults {
  sharingMode: PrismaPersonaSharingMode;
  smartCardConfig: PersonaSmartCardConfig | null;
  source: PersonaSharingConfigSource;
}

const fastSharePersonaSelect = Prisma.validator<Prisma.PersonaSelect>()({
  id: true,
  username: true,
  fullName: true,
  profilePhotoUrl: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
});

type PersonaDbClient = Pick<PrismaService, "persona" | "qRAccessToken">;
type FastSharePersonaRecord = Prisma.PersonaGetPayload<{
  select: typeof fastSharePersonaSelect;
}>;
type ProfileQrEligiblePersona = Pick<
  PrivatePersonaRecord,
  "id" | "accessMode" | "emailVerified" | "phoneVerified"
>;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export type PersonaSharePreferredShareType = "smart_card" | "instant_connect";

export interface FastSharePayload {
  personaId: string;
  username: string;
  fullName: string;
  profilePhotoUrl: string | null;
  shareUrl: string;
  qrValue: string;
  primaryAction: PersonaSmartCardPrimaryAction | null;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

export interface FastShareSelectionResponse {
  selectedPersonaId: string | null;
  sharePayload: FastSharePayload | null;
}

export interface PersonaSharePayload {
  personaId: string;
  username: string;
  fullName: string;
  sharingMode: "controlled" | "smart_card";
  primaryAction: PersonaSmartCardPrimaryAction | null;
  shareUrl: string;
  qrValue: string;
  preferredShareType: PersonaSharePreferredShareType;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
  trust: ReturnType<typeof buildPublicPersonaTrustSignals>;
}

interface QuickConnectAvailability {
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

const FAST_SHARE_CACHE_TTL_MS = 45_000;

const defaultingConfigService: Pick<ConfigService, "get"> = {
  get: <T>(_propertyPath: string, defaultValue?: T) => {
    if (defaultValue === undefined) {
      throw new Error("Config service is not configured");
    }

    return defaultValue;
  },
};

@Injectable()
export class PersonasService {
  private readonly fastSharePayloadCache = new Map<
    string,
    CacheEntry<FastSharePayload>
  >();

  private readonly primaryPersonaCache = new Map<
    string,
    CacheEntry<FastSharePersonaRecord | null>
  >();

  private readonly myFastSharePayloadCache = new Map<
    string,
    CacheEntry<FastShareSelectionResponse>
  >();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService = defaultingConfigService as ConfigService,
  ) {}

  async create(userId: string, createPersonaDto: CreatePersonaDto) {
    try {
      const user = this.prismaService.user
        ? await this.prismaService.user.findUnique({
            where: {
              id: userId,
            },
            select: {
              isVerified: true,
              phoneVerifiedAt: true,
            },
          })
        : {
            isVerified: false,
            phoneVerifiedAt: null,
          };

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const trustState = buildStoredPersonaTrustState(user);
      const persona = await this.prismaService.persona.create({
        data: {
          userId,
          type: toPrismaPersonaType(createPersonaDto.type),
          username: createPersonaDto.username,
          publicUrl: buildPublicUrl(createPersonaDto.username),
          fullName: createPersonaDto.fullName,
          jobTitle: createPersonaDto.jobTitle,
          companyName: createPersonaDto.companyName,
          tagline: createPersonaDto.tagline,
          profilePhotoUrl: createPersonaDto.profilePhotoUrl ?? null,
          accessMode: toPrismaAccessMode(createPersonaDto.accessMode),
          verifiedOnly: createPersonaDto.verifiedOnly ?? false,
          ...trustState,
        },
        select: privatePersonaSelect,
      });

      const personaWithDefaults = await this.applySmartDefaultsOnPersonaCreate(
        persona.id,
      );

      this.invalidateFastShareCache(userId);

      return this.toPrivatePersonaSummary(personaWithDefaults);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Username already in use");
      }

      throw error;
    }
  }

  async findAllByUser(userId: string) {
    const personas = await this.prismaService.persona.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: privatePersonaSelect,
    });

    const normalizedPersonas = await Promise.all(
      personas.map((persona) =>
        this.applySystemManagedSharingDefaultsIfNeeded(persona),
      ),
    );

    const activeProfileQrPersonaIds = new Set(
      (
        await this.prismaService.qRAccessToken.findMany({
          where: {
            personaId: {
              in: normalizedPersonas
                .filter(
                  (persona) =>
                    persona.accessMode !== PrismaPersonaAccessMode.PRIVATE,
                )
                .map((persona) => persona.id),
            },
            type: PrismaQrType.profile,
            status: PrismaQrStatus.active,
          },
          select: {
            personaId: true,
          },
          distinct: ["personaId"],
        })
      ).map((record) => record.personaId),
    );

    await this.ensureActiveProfileQrForPersonas(
      normalizedPersonas,
      activeProfileQrPersonaIds,
    );

    return normalizedPersonas.map((persona) => {
      const hasActiveProfileQr =
        persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
        activeProfileQrPersonaIds.has(persona.id);

      return toPrivatePersonaView(persona, {
        hasActiveProfileQr,
        primaryActions: {
          requestAccess: persona.accessMode !== PrismaPersonaAccessMode.PRIVATE,
          instantConnect:
            persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
            hasActiveProfileQr,
          contactMe: true,
        },
      });
    });
  }

  async findOneById(userId: string, personaId: string) {
    const persona = await this.findOwnedPersona(userId, personaId);

    return this.toPrivatePersonaSummary(persona);
  }

  async getPersonaShareMode(
    userId: string,
    personaId: string,
  ): Promise<PersonaSharePayload> {
    const persona = await this.findOwnedPersona(userId, personaId);

    return this.buildSharePayload(persona);
  }

  async getFastSharePayload(
    userId: string,
    personaId: string,
  ): Promise<FastSharePayload> {
    const cacheKey = `${userId}:${personaId}`;
    const cachedPayload = this.getCachedValue(
      this.fastSharePayloadCache,
      cacheKey,
    );

    if (cachedPayload) {
      return cachedPayload;
    }

    const persona = await this.prismaService.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
      select: fastSharePersonaSelect,
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    const payload = await this.buildFastSharePayload(persona);

    this.setCachedValue(this.fastSharePayloadCache, cacheKey, payload);

    return payload;
  }

  async getPrimaryPersonaForUser(
    userId: string,
  ): Promise<FastSharePersonaRecord | null> {
    const cachedPersona = this.getCachedValue(this.primaryPersonaCache, userId);

    if (cachedPersona !== null) {
      return cachedPersona;
    }

    const persona = await this.prismaService.persona.findFirst({
      where: {
        userId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: fastSharePersonaSelect,
    });

    this.setCachedValue(this.primaryPersonaCache, userId, persona ?? null);

    return persona ?? null;
  }

  async getMyFastSharePayload(
    userId: string,
  ): Promise<FastShareSelectionResponse> {
    const cachedResponse = this.getCachedValue(
      this.myFastSharePayloadCache,
      userId,
    );

    if (cachedResponse) {
      return cachedResponse;
    }

    const selectedPersona = await this.getPrimaryPersonaForUser(userId);

    if (!selectedPersona) {
      const emptyResponse = {
        selectedPersonaId: null,
        sharePayload: null,
      } satisfies FastShareSelectionResponse;

      this.setCachedValue(this.myFastSharePayloadCache, userId, emptyResponse);

      return emptyResponse;
    }

    const response = {
      selectedPersonaId: selectedPersona.id,
      sharePayload: await this.getFastSharePayload(userId, selectedPersona.id),
    } satisfies FastShareSelectionResponse;

    this.setCachedValue(this.myFastSharePayloadCache, userId, response);

    return response;
  }

  async findOwnedPersonaIdentity(userId: string, personaId: string) {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    return {
      id: persona.id,
      fullName: persona.fullName,
    };
  }

  async findOwnedPersonaUserIdentity(userId: string, personaId: string) {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    return persona;
  }

  async update(
    userId: string,
    personaId: string,
    updatePersonaDto: UpdatePersonaDto,
  ) {
    const existingPersona = await this.findOwnedPersona(userId, personaId);

    const data: Prisma.PersonaUpdateInput = {};

    if (updatePersonaDto.type) {
      data.type = toPrismaPersonaType(updatePersonaDto.type);
    }

    if (updatePersonaDto.fullName !== undefined) {
      data.fullName = updatePersonaDto.fullName;
    }

    if (updatePersonaDto.jobTitle !== undefined) {
      data.jobTitle = updatePersonaDto.jobTitle;
    }

    if (updatePersonaDto.companyName !== undefined) {
      data.companyName = updatePersonaDto.companyName;
    }

    if (updatePersonaDto.tagline !== undefined) {
      data.tagline = updatePersonaDto.tagline;
    }

    if (updatePersonaDto.profilePhotoUrl !== undefined) {
      data.profilePhotoUrl = updatePersonaDto.profilePhotoUrl;
    }

    if (updatePersonaDto.accessMode) {
      data.accessMode = toPrismaAccessMode(updatePersonaDto.accessMode);
    }

    if (updatePersonaDto.verifiedOnly !== undefined) {
      data.verifiedOnly = updatePersonaDto.verifiedOnly;
    }

    const nextPersona = this.buildUpdatedPersonaSnapshot(
      existingPersona,
      updatePersonaDto,
    );
    const sharingUpdate = await this.resolveSharingUpdateForPersonaChanges(
      existingPersona,
      nextPersona,
      updatePersonaDto,
    );

    const persona = await this.prismaService.persona.update({
      where: {
        id: personaId,
      },
      data: {
        ...data,
        ...sharingUpdate,
      },
      select: privatePersonaSelect,
    });

    this.invalidateFastShareCache(userId);

    return this.toPrivatePersonaSummary(persona);
  }

  async updateSharingMode(
    userId: string,
    personaId: string,
    updatePersonaSharingDto: UpdatePersonaSharingDto,
  ) {
    const personaDelegate = this.prismaService.persona as unknown as {
      findFirst?: (args: {
        where: {
          id: string;
          userId: string;
        };
        select: {
          accessMode: true;
          emailVerified: true;
          phoneVerified: true;
          sharingMode: true;
          smartCardConfig: true;
          publicPhone: true;
          publicWhatsappNumber: true;
          publicEmail: true;
        };
      }) => Promise<{
        accessMode: PrismaPersonaAccessMode;
        emailVerified: boolean;
        phoneVerified: boolean;
        sharingMode: PrismaPersonaSharingMode;
        smartCardConfig: Prisma.JsonValue | null;
        publicPhone: string | null;
        publicWhatsappNumber: string | null;
        publicEmail: string | null;
      } | null>;
      findUnique?: (args: {
        where: {
          id: string;
        };
        select: {
          userId: true;
          accessMode: true;
          emailVerified: true;
          phoneVerified: true;
          sharingMode: true;
          smartCardConfig: true;
          publicPhone: true;
          publicWhatsappNumber: true;
          publicEmail: true;
        };
      }) => Promise<{
        userId: string;
        accessMode: PrismaPersonaAccessMode;
        emailVerified: boolean;
        phoneVerified: boolean;
        sharingMode: PrismaPersonaSharingMode;
        smartCardConfig: Prisma.JsonValue | null;
        publicPhone: string | null;
        publicWhatsappNumber: string | null;
        publicEmail: string | null;
      } | null>;
    };

    const existingPersona =
      typeof personaDelegate.findFirst === "function"
        ? await personaDelegate.findFirst({
            where: {
              id: personaId,
              userId,
            },
            select: {
              accessMode: true,
              emailVerified: true,
              phoneVerified: true,
              sharingMode: true,
              smartCardConfig: true,
              publicPhone: true,
              publicWhatsappNumber: true,
              publicEmail: true,
            },
          })
        : await personaDelegate.findUnique?.({
            where: {
              id: personaId,
            },
            select: {
              userId: true,
              accessMode: true,
              emailVerified: true,
              phoneVerified: true,
              sharingMode: true,
              smartCardConfig: true,
              publicPhone: true,
              publicWhatsappNumber: true,
              publicEmail: true,
            },
          });

    if (
      !existingPersona ||
      ("userId" in existingPersona && existingPersona.userId !== userId)
    ) {
      throw new NotFoundException("Persona not found");
    }

    const nextSharingMode = updatePersonaSharingDto.sharingMode
      ? toPrismaSharingMode(updatePersonaSharingDto.sharingMode)
      : existingPersona.sharingMode;

    const requestedConfig =
      updatePersonaSharingDto.smartCardConfig !== undefined
        ? updatePersonaSharingDto.smartCardConfig
        : existingPersona.smartCardConfig;

    const publicActionFields = this.resolvePublicActionFields(
      existingPersona,
      updatePersonaSharingDto,
    );

    const smartCardConfig =
      nextSharingMode === PrismaPersonaSharingMode.CONTROLLED
        ? null
        : await (async () => {
            if (requestedConfig === null || requestedConfig === undefined) {
              throw new BadRequestException(
                "smartCardConfig is required when sharingMode is smart_card",
              );
            }

            const normalizedConfig = validateSmartCardConfig(requestedConfig);

            const hasActiveProfileQr =
              normalizedConfig.primaryAction ===
              PersonaSmartCardPrimaryAction.InstantConnect
                ? await this.ensureActiveProfileQrForPersona({
                    id: personaId,
                    accessMode: existingPersona.accessMode,
                    emailVerified: existingPersona.emailVerified,
                    phoneVerified: existingPersona.phoneVerified,
                  })
                : false;

            return validateSmartCardConfigCompatibility(
              normalizedConfig,
              {
                sharingMode: nextSharingMode,
                accessMode: existingPersona.accessMode,
                hasActiveProfileQr,
              },
              publicActionFields,
            );
          })();

    const persona = await this.prismaService.persona.update({
      where: {
        id: personaId,
      },
      data: {
        sharingMode: nextSharingMode,
        smartCardConfig: toStoredSmartCardConfig(
          nextSharingMode === PrismaPersonaSharingMode.CONTROLLED
            ? null
            : smartCardConfig,
          "user_custom",
        ) as Prisma.InputJsonValue,
        publicPhone: publicActionFields.publicPhone,
        publicWhatsappNumber: publicActionFields.publicWhatsappNumber,
        publicEmail: publicActionFields.publicEmail,
      },
      select: privatePersonaSelect,
    });

    this.invalidateFastShareCache(userId);

    return this.toPrivatePersonaSummary(persona);
  }

  async buildSmartDefaultsForPersona(
    persona: PersonaSmartDefaultsTarget,
    db: PersonaDbClient = this.prismaService,
  ): Promise<PersonaSmartDefaults> {
    const hasInstantConnectCapability = await this.hasInstantConnectCapability(
      persona,
      db,
    );
    const sharingMode = this.getDefaultSharingMode(
      persona,
      hasInstantConnectCapability,
    );
    const actionFlags = this.getDefaultActionFlags(persona, sharingMode);
    const primaryAction = this.getDefaultPrimaryAction(
      persona,
      actionFlags,
      hasInstantConnectCapability,
    );

    if (sharingMode === PrismaPersonaSharingMode.CONTROLLED) {
      return {
        sharingMode,
        smartCardConfig: null,
        source: "system_default",
      };
    }

    const generatedConfig = this.validateGeneratedSmartCardConfig(
      {
        primaryAction,
        ...actionFlags,
      },
      persona,
      hasInstantConnectCapability,
    );

    if (generatedConfig !== null) {
      return {
        sharingMode,
        smartCardConfig: generatedConfig,
        source: "system_default",
      };
    }

    return {
      sharingMode: PrismaPersonaSharingMode.CONTROLLED,
      smartCardConfig: null,
      source: "system_default",
    };
  }

  getDefaultSharingMode(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      | "accessMode"
      | "fullName"
      | "publicPhone"
      | "publicWhatsappNumber"
      | "publicEmail"
    >,
    hasInstantConnectCapability: boolean,
  ): PrismaPersonaSharingMode {
    if (persona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      return PrismaPersonaSharingMode.CONTROLLED;
    }

    if (this.hasMeaningfulSmartCardInfo(persona, hasInstantConnectCapability)) {
      return PrismaPersonaSharingMode.SMART_CARD;
    }

    return PrismaPersonaSharingMode.CONTROLLED;
  }

  getDefaultPrimaryAction(
    persona: Pick<PersonaSmartDefaultsTarget, "type" | "accessMode">,
    actionFlags: Omit<PersonaSmartCardConfig, "primaryAction">,
    hasInstantConnectCapability: boolean,
  ): PersonaSmartCardPrimaryAction {
    if (
      hasInstantConnectCapability &&
      this.isSuitableForQuickNetworking(persona)
    ) {
      return PersonaSmartCardPrimaryAction.InstantConnect;
    }

    if (this.hasAnyDirectAction(actionFlags)) {
      return PersonaSmartCardPrimaryAction.ContactMe;
    }

    return PersonaSmartCardPrimaryAction.RequestAccess;
  }

  getDefaultActionFlags(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "fullName" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
    sharingMode: PrismaPersonaSharingMode,
  ): Omit<PersonaSmartCardConfig, "primaryAction"> {
    return {
      allowCall: persona.publicPhone !== null,
      allowWhatsapp: persona.publicWhatsappNumber !== null,
      allowEmail: persona.publicEmail !== null,
      allowVcard:
        sharingMode === PrismaPersonaSharingMode.SMART_CARD &&
        this.hasSafeVcardFields(persona),
    };
  }

  async applySmartDefaultsOnPersonaCreate(personaId: string) {
    const persona = await this.prismaService.persona.findUnique({
      where: {
        id: personaId,
      },
      select: privatePersonaSelect,
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    const defaults = await this.buildSmartDefaultsForPersona(persona);

    return this.prismaService.persona.update({
      where: {
        id: personaId,
      },
      data: {
        sharingMode: defaults.sharingMode,
        smartCardConfig: toStoredSmartCardConfig(
          defaults.smartCardConfig,
          defaults.source,
        ) as Prisma.InputJsonValue,
      },
      select: privatePersonaSelect,
    });
  }

  async recomputePersonaDefaults(
    userId: string,
    personaId: string,
    force = false,
  ) {
    const persona = await this.findOwnedPersona(userId, personaId);

    if (
      !force &&
      getSharingConfigSource(persona.smartCardConfig) !== "system_default"
    ) {
      return this.toPrivatePersonaSummary(persona);
    }

    const defaults = await this.buildSmartDefaultsForPersona(persona);
    const updatedPersona = await this.prismaService.persona.update({
      where: {
        id: personaId,
      },
      data: {
        sharingMode: defaults.sharingMode,
        smartCardConfig: toStoredSmartCardConfig(
          defaults.smartCardConfig,
          defaults.source,
        ) as Prisma.InputJsonValue,
      },
      select: privatePersonaSelect,
    });

    this.invalidateFastShareCache(userId);

    return this.toPrivatePersonaSummary(updatedPersona);
  }

  async remove(userId: string, personaId: string) {
    await this.assertOwner(userId, personaId);

    await this.prismaService.persona.delete({
      where: {
        id: personaId,
      },
    });

    this.invalidateFastShareCache(userId);

    return {
      removed: true,
    };
  }

  private async findOwnedPersona(userId: string, personaId: string) {
    const persona = await this.prismaService.persona.findFirst({
      where: {
        id: personaId,
        userId,
      },
      select: privatePersonaSelect,
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    return persona;
  }

  private async assertOwner(userId: string, personaId: string): Promise<void> {
    await this.findOwnedPersonaIdentity(userId, personaId);
  }

  private async hasActiveProfileQrEnabled(
    personaId: string,
    db: PersonaDbClient = this.prismaService,
  ): Promise<boolean> {
    if (typeof db.qRAccessToken?.findFirst !== "function") {
      return false;
    }

    const activeProfileQr = await db.qRAccessToken.findFirst({
      where: {
        personaId,
        type: PrismaQrType.profile,
        status: PrismaQrStatus.active,
      },
      select: {
        id: true,
      },
    });

    return activeProfileQr !== null;
  }

  private async hasInstantConnectCapability(
    persona: Pick<PersonaSmartDefaultsTarget, "id" | "accessMode">,
    db: PersonaDbClient = this.prismaService,
  ): Promise<boolean> {
    if (persona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      return false;
    }

    return this.hasActiveProfileQrEnabled(persona.id, db);
  }

  private async toPrivatePersonaSummary(persona: PrivatePersonaRecord) {
    const repairedPersona =
      await this.applySystemManagedSharingDefaultsIfNeeded(persona);
    const sharingCapabilities =
      await this.buildSharingCapabilities(repairedPersona);

    return toPrivatePersonaView(repairedPersona, sharingCapabilities);
  }

  private async buildSharePayload(
    persona: PrivatePersonaRecord,
  ): Promise<PersonaSharePayload> {
    const repairedPersona =
      await this.applySystemManagedSharingDefaultsIfNeeded(persona);
    const smartCardConfig = toSafeSmartCardConfig(repairedPersona.smartCardConfig);
    const shareUrl = this.buildShareProfileUrl(repairedPersona.username);
    const quickConnectAvailability =
      await this.resolveQuickConnectAvailability(repairedPersona, smartCardConfig);

    return {
      personaId: repairedPersona.id,
      username: repairedPersona.username,
      fullName: repairedPersona.fullName,
      sharingMode: toApiSharingMode(repairedPersona.sharingMode),
      primaryAction: smartCardConfig?.primaryAction ?? null,
      shareUrl,
      qrValue: shareUrl,
      preferredShareType: this.resolvePreferredShareType(
        smartCardConfig,
        quickConnectAvailability.hasQuickConnect,
      ),
      hasQuickConnect: quickConnectAvailability.hasQuickConnect,
      quickConnectUrl: quickConnectAvailability.quickConnectUrl,
      trust: buildPublicPersonaTrustSignals({
        emailVerified: repairedPersona.emailVerified,
        phoneVerified: repairedPersona.phoneVerified,
        businessVerified: repairedPersona.businessVerified,
      }),
    };
  }

  private async buildFastSharePayload(
    persona: FastSharePersonaRecord,
  ): Promise<FastSharePayload> {
    const smartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);
    const shareUrl = this.buildShareProfileUrl(persona.username);
    const quickConnectAvailability =
      await this.resolveQuickConnectAvailability(persona, smartCardConfig);

    return {
      personaId: persona.id,
      username: persona.username,
      fullName: persona.fullName,
      profilePhotoUrl: persona.profilePhotoUrl,
      shareUrl,
      qrValue: shareUrl,
      primaryAction: smartCardConfig?.primaryAction ?? null,
      hasQuickConnect: quickConnectAvailability.hasQuickConnect,
      quickConnectUrl: quickConnectAvailability.quickConnectUrl,
    };
  }

  private resolvePreferredShareType(
    smartCardConfig: PersonaSmartCardConfig | null,
    hasQuickConnect: boolean,
  ): PersonaSharePreferredShareType {
    if (
      smartCardConfig?.primaryAction ===
        PersonaSmartCardPrimaryAction.InstantConnect &&
      hasQuickConnect
    ) {
      return "instant_connect";
    }

    return "smart_card";
  }

  private async resolveQuickConnectAvailability(
    persona: Pick<FastSharePersonaRecord, "id" | "accessMode" | "sharingMode">,
    smartCardConfig: PersonaSmartCardConfig | null,
  ): Promise<QuickConnectAvailability> {
    if (
      persona.accessMode === PrismaPersonaAccessMode.PRIVATE ||
      persona.sharingMode !== PrismaPersonaSharingMode.SMART_CARD ||
      smartCardConfig?.primaryAction !==
        PersonaSmartCardPrimaryAction.InstantConnect ||
      typeof this.prismaService.qRAccessToken?.findMany !== "function"
    ) {
      return {
        hasQuickConnect: false,
        quickConnectUrl: null,
      };
    }

    const now = new Date();
    const candidateTokens = await this.prismaService.qRAccessToken.findMany({
      where: {
        personaId: persona.id,
        type: PrismaQrType.quick_connect,
        status: PrismaQrStatus.active,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: {
        code: true,
        maxUses: true,
        usedCount: true,
      },
    });

    const activeToken = candidateTokens.find(
      (token) =>
        token.code.trim().length > 0 &&
        (token.maxUses === null || token.usedCount < token.maxUses),
    );

    if (!activeToken) {
      return {
        hasQuickConnect: false,
        quickConnectUrl: null,
      };
    }

    return {
      hasQuickConnect: true,
      quickConnectUrl: this.buildQuickConnectShareUrl(activeToken.code),
    };
  }

  private buildShareProfileUrl(username: string): string {
    return `${this.getFrontendShareBaseUrl()}/u/${encodeURIComponent(
      username.trim().toLowerCase(),
    )}`;
  }

  private buildQuickConnectShareUrl(code: string): string {
    return `${this.getFrontendShareBaseUrl()}/q/${encodeURIComponent(code)}`;
  }

  private getCachedValue<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
  ): T | null {
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
  ): void {
    cache.set(key, {
      value,
      expiresAt: Date.now() + FAST_SHARE_CACHE_TTL_MS,
    });
  }

  private invalidateFastShareCache(userId: string): void {
    this.primaryPersonaCache.delete(userId);
    this.myFastSharePayloadCache.delete(userId);

    for (const cacheKey of this.fastSharePayloadCache.keys()) {
      if (cacheKey.startsWith(`${userId}:`)) {
        this.fastSharePayloadCache.delete(cacheKey);
      }
    }
  }

  private getFrontendShareBaseUrl(): string {
    const configuredCandidates = [
      this.configService.get<string>("mail.frontendVerificationUrlBase", ""),
      this.configService.get<string>("mail.frontendPasswordResetUrlBase", ""),
    ];

    for (const candidate of configuredCandidates) {
      const normalizedCandidate = candidate.trim();

      if (normalizedCandidate.length === 0) {
        continue;
      }

      try {
        return new URL(normalizedCandidate).origin;
      } catch {
        continue;
      }
    }

    return "https://dotly.one";
  }

  private async buildSharingCapabilities(
    persona: Pick<
      PrivatePersonaRecord,
      "id" | "accessMode" | "emailVerified" | "phoneVerified"
    >,
    db: PersonaDbClient = this.prismaService,
  ): Promise<PrivatePersonaSharingCapabilities> {
    const hasActiveProfileQr = await this.ensureActiveProfileQrForPersona(
      persona,
      db,
    );

    return {
      hasActiveProfileQr,
      primaryActions: {
        requestAccess: persona.accessMode !== PrismaPersonaAccessMode.PRIVATE,
        instantConnect:
          persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
          hasActiveProfileQr,
        contactMe: true,
      },
    };
  }

  private canAutoProvisionProfileQr(
    persona: Pick<
      ProfileQrEligiblePersona,
      "accessMode" | "emailVerified" | "phoneVerified"
    >,
  ): boolean {
    return (
      persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
      (persona.emailVerified || persona.phoneVerified)
    );
  }

  private async ensureActiveProfileQrForPersonas(
    personas: ProfileQrEligiblePersona[],
    activeProfileQrPersonaIds: Set<string>,
    db: PersonaDbClient = this.prismaService,
  ): Promise<void> {
    const missingEligiblePersonas = personas.filter(
      (persona) =>
        !activeProfileQrPersonaIds.has(persona.id) &&
        this.canAutoProvisionProfileQr(persona),
    );

    if (missingEligiblePersonas.length === 0) {
      return;
    }

    for (const persona of missingEligiblePersonas) {
      const wasProvisioned = await this.createActiveProfileQrToken(persona.id, db);

      if (wasProvisioned) {
        activeProfileQrPersonaIds.add(persona.id);
      }
    }
  }

  private async ensureActiveProfileQrForPersona(
    persona: ProfileQrEligiblePersona,
    db: PersonaDbClient = this.prismaService,
  ): Promise<boolean> {
    if (persona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      return false;
    }

    if (await this.hasActiveProfileQrEnabled(persona.id, db)) {
      return true;
    }

    if (!this.canAutoProvisionProfileQr(persona)) {
      return false;
    }

    return this.createActiveProfileQrToken(persona.id, db);
  }

  private async createActiveProfileQrToken(
    personaId: string,
    db: PersonaDbClient = this.prismaService,
  ): Promise<boolean> {
    if (
      typeof db.qRAccessToken?.create !== "function" ||
      typeof this.prismaService.qRAccessToken?.findUnique !== "function"
    ) {
      return false;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await this.generateUniqueProfileQrCode();

      try {
        await db.qRAccessToken.create({
          data: {
            personaId,
            type: PrismaQrType.profile,
            code,
            rules: {},
            status: PrismaQrStatus.active,
          },
          select: {
            id: true,
          },
        });

        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException("Unable to generate a unique QR code");
  }

  private async generateUniqueProfileQrCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(9).toString("base64url");
      const existingToken = await this.prismaService.qRAccessToken.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
        },
      });

      if (!existingToken) {
        return code;
      }
    }

    throw new ConflictException("Unable to generate a unique QR code");
  }

  private buildUpdatedPersonaSnapshot(
    persona: PrivatePersonaRecord,
    updatePersonaDto: UpdatePersonaDto,
  ): PrivatePersonaRecord {
    return {
      ...persona,
      type: updatePersonaDto.type
        ? toPrismaPersonaType(updatePersonaDto.type)
        : persona.type,
      fullName:
        updatePersonaDto.fullName !== undefined
          ? updatePersonaDto.fullName
          : persona.fullName,
      jobTitle:
        updatePersonaDto.jobTitle !== undefined
          ? updatePersonaDto.jobTitle
          : persona.jobTitle,
      companyName:
        updatePersonaDto.companyName !== undefined
          ? updatePersonaDto.companyName
          : persona.companyName,
      tagline:
        updatePersonaDto.tagline !== undefined
          ? updatePersonaDto.tagline
          : persona.tagline,
      profilePhotoUrl:
        updatePersonaDto.profilePhotoUrl !== undefined
          ? updatePersonaDto.profilePhotoUrl
          : persona.profilePhotoUrl,
      accessMode: updatePersonaDto.accessMode
        ? toPrismaAccessMode(updatePersonaDto.accessMode)
        : persona.accessMode,
      verifiedOnly:
        updatePersonaDto.verifiedOnly !== undefined
          ? updatePersonaDto.verifiedOnly
          : persona.verifiedOnly,
    };
  }

  private shouldRecomputeSystemDefaultsForCoreUpdate(
    updatePersonaDto: UpdatePersonaDto,
  ): boolean {
    return (
      updatePersonaDto.type !== undefined ||
      updatePersonaDto.accessMode !== undefined ||
      updatePersonaDto.fullName !== undefined
    );
  }

  private needsSystemManagedSharingRepair(
    persona: Pick<PrivatePersonaRecord, "sharingMode" | "smartCardConfig">,
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

  private async resolveSharingUpdateForPersonaChanges(
    existingPersona: PrivatePersonaRecord,
    nextPersona: PrivatePersonaRecord,
    updatePersonaDto: UpdatePersonaDto,
  ): Promise<Prisma.PersonaUpdateInput> {
    const source = getSharingConfigSource(existingPersona.smartCardConfig);

    if (source !== "user_custom") {
      if (
        this.shouldRecomputeSystemDefaultsForCoreUpdate(updatePersonaDto) ||
        this.needsSystemManagedSharingRepair(existingPersona)
      ) {
        const defaults = await this.buildSmartDefaultsForPersona(nextPersona);

        return {
          sharingMode: defaults.sharingMode,
          smartCardConfig: toStoredSmartCardConfig(
            defaults.smartCardConfig,
            defaults.source,
          ) as Prisma.InputJsonValue,
        };
      }

      return {};
    }

    if (
      updatePersonaDto.accessMode === undefined ||
      existingPersona.sharingMode !== PrismaPersonaSharingMode.SMART_CARD
    ) {
      return {};
    }

    const safeConfig = toSafeSmartCardConfig(existingPersona.smartCardConfig);

    if (safeConfig === null) {
      throw new BadRequestException(
        "Current Smart Card settings are incomplete. Update sharing settings before changing access mode.",
      );
    }

    const hasActiveProfileQr =
      safeConfig.primaryAction === PersonaSmartCardPrimaryAction.InstantConnect
        ? await this.hasActiveProfileQrEnabled(existingPersona.id)
        : false;

    validateSmartCardConfigCompatibility(
      safeConfig,
      {
        sharingMode: existingPersona.sharingMode,
        accessMode: nextPersona.accessMode,
        hasActiveProfileQr,
      },
      this.toPublicActionFields(existingPersona),
    );

    return {};
  }

  private async applySystemManagedSharingDefaultsIfNeeded(
    persona: PrivatePersonaRecord,
    db: PersonaDbClient = this.prismaService,
  ): Promise<PrivatePersonaRecord> {
    if (!this.needsSystemManagedSharingRepair(persona)) {
      return persona;
    }

    const defaults = await this.buildSmartDefaultsForPersona(persona, db);

    return {
      ...persona,
      sharingMode: defaults.sharingMode,
      smartCardConfig: toStoredSmartCardConfig(
        defaults.smartCardConfig,
        defaults.source,
      ) as Prisma.JsonValue,
    };
  }

  private isSuitableForQuickNetworking(
    persona: Pick<PersonaSmartDefaultsTarget, "type" | "accessMode">,
  ): boolean {
    return (
      persona.accessMode !== PrismaPersonaAccessMode.PRIVATE &&
      persona.type !== PrismaPersonaType.PERSONAL
    );
  }

  private hasAnyDirectAction(
    actionFlags: Omit<PersonaSmartCardConfig, "primaryAction">,
  ): boolean {
    return (
      actionFlags.allowCall ||
      actionFlags.allowWhatsapp ||
      actionFlags.allowEmail ||
      actionFlags.allowVcard
    );
  }

  private hasMeaningfulSmartCardInfo(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "fullName" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
    hasInstantConnectCapability: boolean,
  ): boolean {
    return (
      persona.fullName.trim().length > 0 &&
      (this.hasAnyPublicActionValue(persona) || hasInstantConnectCapability)
    );
  }

  private hasAnyPublicActionValue(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
  ): boolean {
    return (
      persona.publicPhone !== null ||
      persona.publicWhatsappNumber !== null ||
      persona.publicEmail !== null
    );
  }

  private hasSafeVcardFields(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "fullName" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
  ): boolean {
    return (
      persona.fullName.trim().length > 0 &&
      this.hasAnyPublicActionValue(persona)
    );
  }

  private validateGeneratedSmartCardConfig(
    config: PersonaSmartCardConfig,
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "accessMode" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
    hasInstantConnectCapability: boolean,
  ): PersonaSmartCardConfig | null {
    try {
      return validateSmartCardConfigCompatibility(
        config,
        {
          sharingMode: PrismaPersonaSharingMode.SMART_CARD,
          accessMode: persona.accessMode,
          hasActiveProfileQr: hasInstantConnectCapability,
        },
        this.toPublicActionFields(persona),
      );
    } catch {
      return null;
    }
  }

  private toPublicActionFields(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
  ): PersonaPublicActionFields {
    return {
      publicPhone: persona.publicPhone,
      publicWhatsappNumber: persona.publicWhatsappNumber,
      publicEmail: persona.publicEmail,
    };
  }

  private resolvePublicActionFields(
    existingPersona: {
      publicPhone: string | null;
      publicWhatsappNumber: string | null;
      publicEmail: string | null;
    },
    updatePersonaSharingDto: UpdatePersonaSharingDto,
  ): PersonaPublicActionFields {
    return {
      publicPhone:
        updatePersonaSharingDto.publicPhone !== undefined
          ? normalizePublicPhoneField(
              updatePersonaSharingDto.publicPhone,
              "publicPhone",
            )
          : normalizePublicPhoneField(
              existingPersona.publicPhone,
              "publicPhone",
            ),
      publicWhatsappNumber:
        updatePersonaSharingDto.publicWhatsappNumber !== undefined
          ? normalizePublicPhoneField(
              updatePersonaSharingDto.publicWhatsappNumber,
              "publicWhatsappNumber",
            )
          : normalizePublicPhoneField(
              existingPersona.publicWhatsappNumber,
              "publicWhatsappNumber",
            ),
      publicEmail:
        updatePersonaSharingDto.publicEmail !== undefined
          ? normalizePublicEmailField(
              updatePersonaSharingDto.publicEmail,
              "publicEmail",
            )
          : normalizePublicEmailField(
              existingPersona.publicEmail,
              "publicEmail",
            ),
    };
  }
}
