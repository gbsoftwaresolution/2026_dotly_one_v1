import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IdentityType as PrismaIdentityType,
  Prisma,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaType as PrismaPersonaType,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "../../generated/prisma/client";
import { randomBytes } from "crypto";

import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { PersonaType } from "../../common/enums/persona-type.enum";
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
  buildSmartCardActions,
  getSharingConfigSource,
  type PersonaSharingConfigSource,
  type PersonaSmartCardConfig,
  type PersonaPublicActionFields,
  normalizePublicEmailField,
  normalizePublicPhoneField,
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
import { normalizePersonaRoutingDisplayName } from "./persona-routing";
import {
  PERSONA_USERNAME_STANDARD_MIN_LENGTH,
  validatePersonaUsernameCandidate,
} from "./persona-username";
import { resolveCanonicalPublicSlug } from "./public-url";

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

const fastSharePersonaSelect = {
  id: true,
  identity: {
    select: {
      handle: true,
    },
  },
  isPrimary: true,
  isDefaultRouting: true,
  username: true,
  fullName: true,
  profilePhotoUrl: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
  publicPhone: true,
  publicWhatsappNumber: true,
  publicEmail: true,
} satisfies Prisma.PersonaSelect;

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
  primaryAction: PersonaSmartCardPrimaryAction;
  effectiveActions: PersonaShareEffectiveActions;
  preferredShareType: PersonaSharePreferredShareType;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

export interface FastShareSelectionResponse {
  persona: {
    id: string;
    username: string;
    fullName: string;
    profilePhotoUrl: string | null;
  } | null;
  share: {
    shareUrl: string;
    qrValue: string;
    primaryAction: PersonaSmartCardPrimaryAction;
    effectiveActions: PersonaShareEffectiveActions;
    preferredShareType: PersonaSharePreferredShareType;
  } | null;
}

export interface PersonaSharePayload {
  personaId: string;
  username: string;
  fullName: string;
  sharingMode: "controlled" | "smart_card";
  primaryAction: PersonaSmartCardPrimaryAction;
  shareUrl: string;
  qrValue: string;
  effectiveActions: PersonaShareEffectiveActions;
  preferredShareType: PersonaSharePreferredShareType;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
  trust: ReturnType<typeof buildPublicPersonaTrustSignals>;
}

interface QuickConnectAvailability {
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

export interface PersonaShareEffectiveActions {
  canCall: boolean;
  canWhatsapp: boolean;
  canEmail: boolean;
  canSaveContact: boolean;
}

interface ResolvedPreferredShareConfig {
  sharingMode: "controlled" | "smart_card";
  primaryAction: PersonaSmartCardPrimaryAction;
  shareUrl: string;
  qrValue: string;
  effectiveActions: PersonaShareEffectiveActions;
  preferredShareType: PersonaSharePreferredShareType;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

const FAST_SHARE_CACHE_TTL_MS = 45_000;

interface PersonaRoutingSnapshot {
  identityId: string;
  routingKey: string | null;
  routingDisplayName: string | null;
  isDefaultRouting: boolean;
  routingRulesJson: unknown | null;
}

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
    const usernameValidation = validatePersonaUsernameCandidate(
      createPersonaDto.username,
    );

    if (!usernameValidation.available) {
      throw new BadRequestException(usernameValidation.message);
    }

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

      const existingPersonaCount =
        typeof this.prismaService.persona.count === "function"
          ? await this.prismaService.persona.count({
              where: {
                userId,
              },
            })
          : 0;

      const trustState = buildStoredPersonaTrustState(user);
      const resolvedIdentityId = await this.resolvePersonaIdentityId(
        userId,
        createPersonaDto,
      );
      const routingSnapshot = this.buildRoutingSnapshot({
        identityId: resolvedIdentityId,
        routingKey: createPersonaDto.routingKey ?? null,
        routingDisplayName: createPersonaDto.routingDisplayName ?? null,
        isDefaultRouting: createPersonaDto.isDefaultRouting ?? false,
        routingRulesJson:
          createPersonaDto.routingRulesJson === undefined
            ? null
            : createPersonaDto.routingRulesJson,
      });

      await this.ensureRoutingKeyAvailable(
        routingSnapshot.identityId,
        routingSnapshot.routingKey,
      );

      const persona = await this.withPersonaTransaction(async (tx) => {
        const createdPersona = await (
          tx.persona.create as unknown as (
            args: Record<string, unknown>,
          ) => Promise<PrivatePersonaRecord>
        )({
          data: {
            userId,
            identity: {
              connect: {
                id: resolvedIdentityId,
              },
            },
            type: toPrismaPersonaType(createPersonaDto.type),
            isPrimary: existingPersonaCount === 0,
            username: createPersonaDto.username,
            publicUrl: buildPublicUrl(createPersonaDto.username),
            fullName: createPersonaDto.fullName,
            jobTitle: createPersonaDto.jobTitle,
            companyName: createPersonaDto.companyName ?? null,
            tagline: createPersonaDto.tagline ?? null,
            websiteUrl: createPersonaDto.websiteUrl ?? null,
            isVerified: createPersonaDto.isVerified ?? false,
            profilePhotoUrl: createPersonaDto.profilePhotoUrl ?? null,
            accessMode: toPrismaAccessMode(createPersonaDto.accessMode),
            verifiedOnly: createPersonaDto.verifiedOnly ?? false,
            routingKey: routingSnapshot.routingKey,
            routingDisplayName: routingSnapshot.routingDisplayName,
            isDefaultRouting: routingSnapshot.isDefaultRouting,
            routingRulesJson:
              createPersonaDto.routingRulesJson === null
                ? Prisma.JsonNull
                : ((createPersonaDto.routingRulesJson as Prisma.InputJsonValue) ??
                  null),
            ...trustState,
          },
          select: privatePersonaSelect,
        });

        await this.synchronizeIdentityDefaultRouting(
          routingSnapshot.identityId,
          {
            preferredPersonaId: routingSnapshot.isDefaultRouting
              ? createdPersona.id
              : undefined,
          },
          tx,
        );

        return this.readPersonaById(tx, createdPersona.id, createdPersona);
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
        this.rethrowPersonaConstraintConflict(error);
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

    await this.persistLastUsedPersonaId(userId, personaId);

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

    await this.persistLastUsedPersonaId(userId, personaId);

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

    const lastUsedPersonaId = await this.getLastUsedPersonaId(userId);

    if (lastUsedPersonaId !== null) {
      const lastUsedPersona = await this.prismaService.persona.findFirst({
        where: {
          id: lastUsedPersonaId,
          userId,
        },
        select: fastSharePersonaSelect,
      });

      if (lastUsedPersona) {
        this.setCachedValue(this.primaryPersonaCache, userId, lastUsedPersona);

        return lastUsedPersona;
      }
    }

    const persona = await this.prismaService.persona.findFirst({
      where: {
        userId,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
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
        persona: null,
        share: null,
      } satisfies FastShareSelectionResponse;

      this.setCachedValue(this.myFastSharePayloadCache, userId, emptyResponse);

      return emptyResponse;
    }

    const response = {
      persona: {
        id: selectedPersona.id,
        username: selectedPersona.username,
        fullName: selectedPersona.fullName,
        profilePhotoUrl: selectedPersona.profilePhotoUrl,
      },
      share: this.toFastShareResponse(
        await this.getFastSharePayload(userId, selectedPersona.id),
      ),
    } satisfies FastShareSelectionResponse;

    this.setCachedValue(this.myFastSharePayloadCache, userId, response);

    return response;
  }

  async checkUsernameAvailability(userId: string, rawUsername: string) {
    void userId;

    const validation = validatePersonaUsernameCandidate(rawUsername);

    if (!validation.available) {
      return validation;
    }

    const existingPersona = await this.prismaService.persona.findFirst({
      where: {
        username: validation.username,
      },
      select: {
        id: true,
      },
    });

    if (existingPersona) {
      return {
        username: validation.username,
        available: false,
        code: "taken" as const,
        message: "This username is already taken.",
        requiresClaim:
          validation.username.length < PERSONA_USERNAME_STANDARD_MIN_LENGTH,
      };
    }

    return validation;
  }

  async findOwnedPersonaIdentity(userId: string, personaId: string) {
    const persona = await (
      this.prismaService.persona.findFirst as unknown as (
        args: Record<string, unknown>,
      ) => Promise<{
        id: string;
        identityId: string;
        fullName: string;
      } | null>
    )({
      where: {
        id: personaId,
        userId,
      },
      select: {
        id: true,
        identityId: true,
        fullName: true,
      },
    });

    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    return {
      id: persona.id,
      identityId: persona.identityId,
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
    try {
      const existingPersona = await this.findOwnedPersona(userId, personaId);
      const nextIdentityId =
        updatePersonaDto.identityId === undefined
          ? existingPersona.identityId
          : await this.ensureIdentityOwnership(
              userId,
              updatePersonaDto.identityId,
            );

      const routingSnapshot = this.buildRoutingSnapshot({
        identityId: nextIdentityId,
        routingKey:
          updatePersonaDto.routingKey !== undefined
            ? (updatePersonaDto.routingKey ?? null)
            : existingPersona.routingKey,
        routingDisplayName:
          updatePersonaDto.routingDisplayName !== undefined
            ? (updatePersonaDto.routingDisplayName ?? null)
            : existingPersona.routingDisplayName,
        isDefaultRouting:
          updatePersonaDto.isDefaultRouting !== undefined
            ? updatePersonaDto.isDefaultRouting
            : existingPersona.isDefaultRouting,
        routingRulesJson:
          updatePersonaDto.routingRulesJson !== undefined
            ? updatePersonaDto.routingRulesJson
            : existingPersona.routingRulesJson,
      });

      const shouldRevalidateRoutingKey =
        updatePersonaDto.identityId !== undefined ||
        updatePersonaDto.routingKey !== undefined;

      if (shouldRevalidateRoutingKey) {
        await this.ensureRoutingKeyAvailable(
          routingSnapshot.identityId,
          routingSnapshot.routingKey,
          personaId,
        );
      }

      const data: Prisma.PersonaUpdateInput = {};

      if (updatePersonaDto.type) {
        data.type = toPrismaPersonaType(updatePersonaDto.type);
      }

      if (updatePersonaDto.identityId !== undefined) {
        (data as Prisma.PersonaUpdateInput & { identity?: unknown }).identity =
          {
            connect: {
              id: nextIdentityId,
            },
          };
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

      if (updatePersonaDto.websiteUrl !== undefined) {
        data.websiteUrl = updatePersonaDto.websiteUrl;
      }

      if (updatePersonaDto.isVerified !== undefined) {
        data.isVerified = updatePersonaDto.isVerified;
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

      if (updatePersonaDto.routingKey !== undefined) {
        data.routingKey = routingSnapshot.routingKey;
      }

      if (updatePersonaDto.routingDisplayName !== undefined) {
        data.routingDisplayName = routingSnapshot.routingDisplayName;
      }

      if (updatePersonaDto.isDefaultRouting !== undefined) {
        data.isDefaultRouting = routingSnapshot.isDefaultRouting;
      }

      if (updatePersonaDto.routingRulesJson !== undefined) {
        data.routingRulesJson =
          updatePersonaDto.routingRulesJson === null
            ? Prisma.JsonNull
            : (updatePersonaDto.routingRulesJson as Prisma.InputJsonValue);
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
      const nextDefaultRoutingOptions = {
        preferredPersonaId:
          updatePersonaDto.isDefaultRouting === true ? personaId : undefined,
        excludedPersonaId:
          updatePersonaDto.isDefaultRouting === false &&
          existingPersona.identityId === nextIdentityId &&
          existingPersona.isDefaultRouting
            ? personaId
            : undefined,
      };

      const persona = await this.withPersonaTransaction(async (tx) => {
        const updatedPersona = await tx.persona.update({
          where: {
            id: personaId,
          },
          data: {
            ...data,
            ...sharingUpdate,
          },
          select: privatePersonaSelect,
        });

        if (existingPersona.identityId !== nextIdentityId) {
          await this.synchronizeIdentityDefaultRouting(
            existingPersona.identityId,
            {},
            tx,
          );
        }

        await this.synchronizeIdentityDefaultRouting(
          nextIdentityId,
          nextDefaultRoutingOptions,
          tx,
        );

        return this.readPersonaById(tx, personaId, updatedPersona);
      });

      this.invalidateFastShareCache(userId);

      return this.toPrivatePersonaSummary(persona);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        this.rethrowPersonaConstraintConflict(error);
      }

      throw error;
    }
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

    if (typeof this.prismaService.user?.updateMany === "function") {
      await this.prismaService.user.updateMany({
        where: {
          id: userId,
          lastUsedPersonaId: personaId,
        },
        data: {
          lastUsedPersonaId: null,
        },
      });
    }

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

  private buildRoutingSnapshot(
    input: PersonaRoutingSnapshot,
  ): PersonaRoutingSnapshot {
    return {
      identityId: input.identityId,
      routingKey: input.routingKey,
      routingDisplayName: normalizePersonaRoutingDisplayName(
        input.routingDisplayName,
      ) as string | null,
      isDefaultRouting: input.isDefaultRouting,
      routingRulesJson: input.routingRulesJson,
    };
  }

  private async ensureRoutingKeyAvailable(
    identityId: string,
    routingKey: string | null,
    currentPersonaId?: string,
    db: Pick<PrismaService, "persona"> = this.prismaService,
  ): Promise<void> {
    if (routingKey === null || typeof db.persona.findFirst !== "function") {
      return;
    }

    const existingPersona = await db.persona.findFirst({
      where: {
        identityId,
        routingKey,
        ...(currentPersonaId
          ? {
              NOT: {
                id: currentPersonaId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingPersona) {
      throw new ConflictException(
        "Routing key already in use for this identity.",
      );
    }
  }

  private async synchronizeIdentityDefaultRouting(
    identityId: string,
    options: {
      preferredPersonaId?: string;
      excludedPersonaId?: string;
    },
    db: Pick<PrismaService, "persona"> = this.prismaService,
  ): Promise<void> {
    if (
      typeof db.persona.findMany !== "function" ||
      typeof db.persona.updateMany !== "function" ||
      typeof db.persona.update !== "function"
    ) {
      return;
    }

    const personas = await db.persona.findMany({
      where: {
        identityId,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        isDefaultRouting: true,
      },
    });

    if (personas.length === 0) {
      return;
    }

    const preferredPersona =
      options.preferredPersonaId !== undefined
        ? personas.find((persona) => persona.id === options.preferredPersonaId)
        : undefined;
    const currentDefaultPersona = personas.find(
      (persona) =>
        persona.isDefaultRouting && persona.id !== options.excludedPersonaId,
    );
    const firstEligiblePersona = personas.find(
      (persona) => persona.id !== options.excludedPersonaId,
    );
    const nextDefaultPersonaId =
      preferredPersona?.id ??
      currentDefaultPersona?.id ??
      firstEligiblePersona?.id ??
      personas[0]?.id;

    if (!nextDefaultPersonaId) {
      return;
    }

    await db.persona.updateMany({
      where: {
        identityId,
        isDefaultRouting: true,
        NOT: {
          id: nextDefaultPersonaId,
        },
      },
      data: {
        isDefaultRouting: false,
      },
    });

    if (
      !personas.some(
        (persona) =>
          persona.id === nextDefaultPersonaId && persona.isDefaultRouting,
      )
    ) {
      await db.persona.update({
        where: {
          id: nextDefaultPersonaId,
        },
        data: {
          isDefaultRouting: true,
        },
      });
    }
  }

  private async readPersonaById(
    db: Pick<PrismaService, "persona">,
    personaId: string,
    fallbackPersona: PrivatePersonaRecord,
  ): Promise<PrivatePersonaRecord> {
    if (typeof db.persona.findUnique !== "function") {
      return fallbackPersona;
    }

    const persona = await db.persona.findUnique({
      where: {
        id: personaId,
      },
      select: privatePersonaSelect,
    });

    return persona ?? fallbackPersona;
  }

  private async withPersonaTransaction<T>(
    callback: (tx: Pick<PrismaService, "persona">) => Promise<T>,
  ): Promise<T> {
    if (typeof this.prismaService.$transaction !== "function") {
      return callback(this.prismaService);
    }

    return this.prismaService.$transaction(async (tx) => callback(tx));
  }

  private rethrowPersonaConstraintConflict(
    error: Prisma.PrismaClientKnownRequestError,
  ): never {
    const target = JSON.stringify(error.meta?.target ?? "");

    if (target.includes("username")) {
      throw new ConflictException("Username already in use");
    }

    if (target.includes("routingKey")) {
      throw new ConflictException(
        "Routing key already in use for this identity.",
      );
    }

    if (target.includes("isDefaultRouting")) {
      throw new ConflictException(
        "Default routing persona already exists for this identity.",
      );
    }

    throw error;
  }

  private async resolvePersonaIdentityId(
    userId: string,
    createPersonaDto: CreatePersonaDto,
  ): Promise<string> {
    if (
      typeof this.prismaService.identity?.findFirst !== "function" ||
      typeof this.prismaService.identity?.create !== "function"
    ) {
      return (
        createPersonaDto.identityId ??
        `identity:${userId}:${createPersonaDto.type}`
      );
    }

    if (createPersonaDto.identityId) {
      return this.ensureIdentityOwnership(userId, createPersonaDto.identityId);
    }

    const personaIdentityType = toPrismaIdentityTypeFromPersonaType(
      createPersonaDto.type,
    );
    const existingIdentity = await this.prismaService.identity.findFirst({
      where: {
        personId: userId,
        identityType: personaIdentityType,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
      },
    });

    if (existingIdentity) {
      return existingIdentity.id;
    }

    const createdIdentity = await this.prismaService.identity.create({
      data: {
        personId: userId,
        identityType: personaIdentityType,
        displayName: createPersonaDto.fullName,
        handle: null,
        verificationLevel: "unverified",
        status: "active",
        metadataJson: {
          autoCreatedFromPersonaType: createPersonaDto.type,
          source: "persona_create",
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    return createdIdentity.id;
  }

  private async ensureIdentityOwnership(
    userId: string,
    identityId: string,
  ): Promise<string> {
    if (typeof this.prismaService.identity?.findFirst !== "function") {
      return identityId;
    }

    const identity = await this.prismaService.identity.findFirst({
      where: {
        id: identityId,
        personId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!identity) {
      throw new BadRequestException("Identity not found for this user");
    }

    return identity.id;
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
    const preferredShare =
      await this.resolvePreferredShareConfig(repairedPersona);

    return {
      personaId: repairedPersona.id,
      username: repairedPersona.username,
      fullName: repairedPersona.fullName,
      sharingMode: preferredShare.sharingMode,
      primaryAction: preferredShare.primaryAction,
      shareUrl: preferredShare.shareUrl,
      qrValue: preferredShare.qrValue,
      effectiveActions: preferredShare.effectiveActions,
      preferredShareType: preferredShare.preferredShareType,
      hasQuickConnect: preferredShare.hasQuickConnect,
      quickConnectUrl: preferredShare.quickConnectUrl,
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
    const preferredShare = await this.resolvePreferredShareConfig(persona);

    return {
      personaId: persona.id,
      username: persona.username,
      fullName: persona.fullName,
      profilePhotoUrl: persona.profilePhotoUrl,
      shareUrl: preferredShare.shareUrl,
      qrValue: preferredShare.qrValue,
      primaryAction: preferredShare.primaryAction,
      effectiveActions: preferredShare.effectiveActions,
      preferredShareType: preferredShare.preferredShareType,
      hasQuickConnect: preferredShare.hasQuickConnect,
      quickConnectUrl: preferredShare.quickConnectUrl,
    };
  }

  private async resolvePreferredShareConfig(
    persona: Pick<
      FastSharePersonaRecord,
      | "id"
      | "username"
      | "identity"
      | "isPrimary"
      | "isDefaultRouting"
      | "accessMode"
      | "sharingMode"
      | "smartCardConfig"
      | "publicPhone"
      | "publicWhatsappNumber"
      | "publicEmail"
    >,
  ): Promise<ResolvedPreferredShareConfig> {
    const canonicalShareUrl = this.buildShareProfileUrl(persona);
    const fallback = this.buildPreferredShareFallback(canonicalShareUrl);

    if (persona.sharingMode !== PrismaPersonaSharingMode.SMART_CARD) {
      return fallback;
    }

    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);

    if (safeSmartCardConfig === null) {
      return fallback;
    }

    try {
      const quickConnectAvailability =
        await this.resolveQuickConnectAvailability(
          persona,
          safeSmartCardConfig,
        );
      const compatibleSmartCardConfig = validateSmartCardConfigCompatibility(
        safeSmartCardConfig,
        {
          sharingMode: PrismaPersonaSharingMode.SMART_CARD,
          accessMode: persona.accessMode,
          hasActiveProfileQr: quickConnectAvailability.hasQuickConnect,
        },
        this.toPublicActionFields(persona),
      );
      const smartCardActions = buildSmartCardActions({
        sharingMode: PrismaPersonaSharingMode.SMART_CARD,
        smartCardConfig: compatibleSmartCardConfig,
        publicPhone: persona.publicPhone,
        publicWhatsappNumber: persona.publicWhatsappNumber,
        publicEmail: persona.publicEmail,
      });
      const effectiveActions = {
        canCall: smartCardActions.call,
        canWhatsapp: smartCardActions.whatsapp,
        canEmail: smartCardActions.email,
        canSaveContact: smartCardActions.vcard,
      } satisfies PersonaShareEffectiveActions;
      const primaryAction = this.resolveEffectivePrimaryAction({
        hasInstantConnect: quickConnectAvailability.hasQuickConnect,
        effectiveActions,
      });
      const preferredShareType =
        primaryAction === PersonaSmartCardPrimaryAction.InstantConnect
          ? "instant_connect"
          : "smart_card";
      const resolvedShareUrl =
        preferredShareType === "instant_connect" &&
        quickConnectAvailability.quickConnectUrl !== null
          ? quickConnectAvailability.quickConnectUrl
          : canonicalShareUrl;

      return {
        sharingMode: "smart_card",
        primaryAction,
        shareUrl: resolvedShareUrl,
        qrValue: resolvedShareUrl,
        effectiveActions,
        preferredShareType,
        hasQuickConnect: quickConnectAvailability.hasQuickConnect,
        quickConnectUrl: quickConnectAvailability.quickConnectUrl,
      };
    } catch {
      return fallback;
    }
  }

  private resolveEffectivePrimaryAction(options: {
    hasInstantConnect: boolean;
    effectiveActions: PersonaShareEffectiveActions;
  }): PersonaSmartCardPrimaryAction {
    if (options.hasInstantConnect) {
      return PersonaSmartCardPrimaryAction.InstantConnect;
    }

    if (
      options.effectiveActions.canCall ||
      options.effectiveActions.canWhatsapp ||
      options.effectiveActions.canEmail
    ) {
      return PersonaSmartCardPrimaryAction.ContactMe;
    }

    return PersonaSmartCardPrimaryAction.RequestAccess;
  }

  private buildPreferredShareFallback(
    canonicalShareUrl: string,
  ): ResolvedPreferredShareConfig {
    return {
      sharingMode: "controlled",
      primaryAction: PersonaSmartCardPrimaryAction.RequestAccess,
      shareUrl: canonicalShareUrl,
      qrValue: canonicalShareUrl,
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: false,
      },
      preferredShareType: "smart_card",
      hasQuickConnect: false,
      quickConnectUrl: null,
    };
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

  private toFastShareResponse(
    payload: FastSharePayload,
  ): NonNullable<FastShareSelectionResponse["share"]> {
    return {
      shareUrl: payload.shareUrl,
      qrValue: payload.qrValue,
      primaryAction: payload.primaryAction,
      effectiveActions: payload.effectiveActions,
      preferredShareType: payload.preferredShareType,
    };
  }

  private buildShareProfileUrl(
    persona: Pick<
      FastSharePersonaRecord,
      "username" | "identity" | "isPrimary" | "isDefaultRouting"
    >,
  ): string {
    const shareSlug =
      persona.identity?.handle &&
      (persona.isDefaultRouting || persona.isPrimary)
        ? resolveCanonicalPublicSlug({
            username: persona.username,
            handle: persona.identity.handle,
          })
        : persona.username.trim().toLowerCase();

    return `${this.getFrontendShareBaseUrl()}/u/${encodeURIComponent(shareSlug)}`;
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

  private async getLastUsedPersonaId(userId: string): Promise<string | null> {
    if (typeof this.prismaService.user?.findUnique !== "function") {
      return null;
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        lastUsedPersonaId: true,
      },
    });

    return user?.lastUsedPersonaId ?? null;
  }

  private async persistLastUsedPersonaId(
    userId: string,
    personaId: string,
  ): Promise<void> {
    if (typeof this.prismaService.user?.update !== "function") {
      return;
    }

    try {
      await this.prismaService.user.update({
        where: {
          id: userId,
        },
        data: {
          lastUsedPersonaId: personaId,
        },
      });
      this.primaryPersonaCache.delete(userId);
      this.myFastSharePayloadCache.delete(userId);
    } catch {
      // Share reads must stay non-failing even if last-used persistence is unavailable.
    }
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
      const wasProvisioned = await this.createActiveProfileQrToken(
        persona.id,
        db,
      );

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
      websiteUrl:
        updatePersonaDto.websiteUrl !== undefined
          ? updatePersonaDto.websiteUrl
          : persona.websiteUrl,
      isVerified:
        updatePersonaDto.isVerified !== undefined
          ? updatePersonaDto.isVerified
          : persona.isVerified,
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

function toPrismaIdentityTypeFromPersonaType(
  personaType: PersonaType,
): PrismaIdentityType {
  switch (personaType) {
    case PersonaType.Personal:
      return PrismaIdentityType.PERSONAL;
    case PersonaType.Professional:
      return PrismaIdentityType.PROFESSIONAL;
    case PersonaType.Business:
      return PrismaIdentityType.BUSINESS;
  }

  throw new Error("Unsupported persona type");
}
