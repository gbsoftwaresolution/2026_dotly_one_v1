import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaType as PrismaPersonaType,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "@prisma/client";

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
  isPhoneLikeValue,
  getSharingConfigSource,
  type PersonaSharingConfigSource,
  type PersonaSmartCardConfig,
  type PersonaPublicActionFields,
  toSafeSmartCardConfig,
  toStoredSmartCardConfig,
  toPrismaSharingMode,
  validateSmartCardConfig,
  validateSmartCardConfigCompatibility,
} from "./persona-sharing";
import { buildPersonaTrustState } from "./persona-trust";

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

type PersonaDbClient = Pick<PrismaService, "persona" | "qRAccessToken">;

@Injectable()
export class PersonasService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: string, createPersonaDto: CreatePersonaDto) {
    try {
      const trustedVerification = await this.getTrustedVerificationState(userId);
      const trustState = buildPersonaTrustState(trustedVerification);
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
          emailVerified: trustedVerification.emailVerified,
          phoneVerified: trustedVerification.phoneVerified,
          businessVerified: trustedVerification.businessVerified,
          trustScore: trustState.trustScore,
        },
        select: privatePersonaSelect,
      });

      const personaWithDefaults = await this.applySmartDefaultsOnPersonaCreate(
        persona.id,
      );

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

    return Promise.all(
      personas.map((persona) => this.toPrivatePersonaSummary(persona)),
    );
  }

  async findOneById(userId: string, personaId: string) {
    const persona = await this.findOwnedPersona(userId, personaId);

    return this.toPrivatePersonaSummary(persona);
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

    return this.toPrivatePersonaSummary(persona);
  }

  async updateSharingMode(
    userId: string,
    personaId: string,
    updatePersonaSharingDto: UpdatePersonaSharingDto,
  ) {
    const existingPersona = await this.prismaService.persona.findUnique({
      where: {
        id: personaId,
      },
      select: {
        userId: true,
        accessMode: true,
        sharingMode: true,
        smartCardConfig: true,
        publicPhone: true,
        publicWhatsappNumber: true,
        publicEmail: true,
      },
    });

    if (!existingPersona) {
      throw new NotFoundException("Persona not found");
    }

    if (existingPersona.userId !== userId) {
      throw new ForbiddenException("You do not own this persona");
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
                ? await this.hasActiveProfileQrEnabled(personaId)
                : false;

            return validateSmartCardConfigCompatibility(normalizedConfig, {
              sharingMode: nextSharingMode,
              accessMode: existingPersona.accessMode,
              hasActiveProfileQr,
            }, publicActionFields);
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
      smartCardConfig: this.buildFallbackSmartCardConfig(persona),
      source: "system_default",
    };
  }

  getDefaultSharingMode(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "accessMode" | "fullName" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
    hasInstantConnectCapability: boolean,
  ): PrismaPersonaSharingMode {
    if (persona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      return PrismaPersonaSharingMode.CONTROLLED;
    }

    if (
      this.hasMeaningfulSmartCardInfo(persona, hasInstantConnectCapability)
    ) {
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

    if (!force && getSharingConfigSource(persona.smartCardConfig) !== "system_default") {
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

    return this.toPrivatePersonaSummary(updatedPersona);
  }

  async remove(userId: string, personaId: string) {
    await this.assertOwner(userId, personaId);

    await this.prismaService.persona.delete({
      where: {
        id: personaId,
      },
    });

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

  private async getTrustedVerificationState(userId: string) {
    const user = await this.prismaService.user?.findUnique?.({
      where: {
        id: userId,
      },
      select: {
        isVerified: true,
        phoneVerifiedAt: true,
      },
    });

    return {
      emailVerified: user?.isVerified ?? false,
      phoneVerified: Boolean(user?.phoneVerifiedAt),
      businessVerified: false,
    };
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
    const repairedPersona = await this.repairSystemManagedSharingIfNeeded(
      persona,
    );
    const sharingCapabilities = await this.buildSharingCapabilities(
      repairedPersona,
    );

    return toPrivatePersonaView(repairedPersona, sharingCapabilities);
  }

  private async buildSharingCapabilities(
    persona: Pick<PrivatePersonaRecord, "id" | "accessMode">,
    db: PersonaDbClient = this.prismaService,
  ): Promise<PrivatePersonaSharingCapabilities> {
    const hasActiveProfileQr =
      persona.accessMode === PrismaPersonaAccessMode.PRIVATE
        ? false
        : await this.hasActiveProfileQrEnabled(persona.id, db);

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
      return true;
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

  private async repairSystemManagedSharingIfNeeded(
    persona: PrivatePersonaRecord,
    db: PersonaDbClient = this.prismaService,
  ): Promise<PrivatePersonaRecord> {
    if (!this.needsSystemManagedSharingRepair(persona)) {
      return persona;
    }

    const defaults = await this.buildSmartDefaultsForPersona(persona, db);

    return db.persona.update({
      where: {
        id: persona.id,
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
      persona.fullName.trim().length > 0 && this.hasAnyPublicActionValue(persona)
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

  private buildFallbackSmartCardConfig(
    persona: Pick<
      PersonaSmartDefaultsTarget,
      "accessMode" | "publicPhone" | "publicWhatsappNumber" | "publicEmail"
    >,
  ): PersonaSmartCardConfig | null {
    if (persona.accessMode === PrismaPersonaAccessMode.PRIVATE) {
      return null;
    }

    return validateSmartCardConfigCompatibility(
      {
        primaryAction: PersonaSmartCardPrimaryAction.RequestAccess,
        allowCall: false,
        allowWhatsapp: false,
        allowEmail: false,
        allowVcard: false,
      },
      {
        sharingMode: PrismaPersonaSharingMode.SMART_CARD,
        accessMode: persona.accessMode,
        hasActiveProfileQr: false,
      },
      this.toPublicActionFields(persona),
    );
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
          ? this.normalizePublicPhoneField(
              updatePersonaSharingDto.publicPhone,
              "publicPhone",
            )
          : this.normalizePublicPhoneField(
              existingPersona.publicPhone,
              "publicPhone",
            ),
      publicWhatsappNumber:
        updatePersonaSharingDto.publicWhatsappNumber !== undefined
          ? this.normalizePublicPhoneField(
              updatePersonaSharingDto.publicWhatsappNumber,
              "publicWhatsappNumber",
            )
          : this.normalizePublicPhoneField(
              existingPersona.publicWhatsappNumber,
              "publicWhatsappNumber",
            ),
      publicEmail:
        updatePersonaSharingDto.publicEmail !== undefined
          ? this.normalizePublicEmailField(
              updatePersonaSharingDto.publicEmail,
              "publicEmail",
            )
          : this.normalizePublicEmailField(
              existingPersona.publicEmail,
              "publicEmail",
            ),
    };
  }

  private normalizePublicPhoneField(
    value: unknown,
    fieldName: "publicPhone" | "publicWhatsappNumber",
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      return null;
    }

    if (!isPhoneLikeValue(normalizedValue)) {
      throw new BadRequestException(
        `${fieldName} must be a valid phone-like string`,
      );
    }

    return normalizedValue;
  }

  private normalizePublicEmailField(
    value: unknown,
    fieldName: "publicEmail",
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException(`${fieldName} must be a string`);
    }

    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue.length === 0) {
      return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedValue)) {
      throw new BadRequestException(`${fieldName} must be a valid email`);
    }

    return normalizedValue;
  }
}
