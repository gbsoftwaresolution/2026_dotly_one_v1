import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
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
  buildPublicUrl,
  privatePersonaSelect,
  toPrismaAccessMode,
  toPrismaPersonaType,
  toPrivatePersonaView,
} from "./persona.presenter";
import {
  isPhoneLikeValue,
  type PersonaPublicActionFields,
  toPrismaSharingMode,
  validateSmartCardConfig,
  validateSmartCardConfigCompatibility,
} from "./persona-sharing";

@Injectable()
export class PersonasService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: string, createPersonaDto: CreatePersonaDto) {
    try {
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
        },
        select: privatePersonaSelect,
      });

      return toPrivatePersonaView(persona);
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

    return personas.map(toPrivatePersonaView);
  }

  async findOneById(userId: string, personaId: string) {
    const persona = await this.findOwnedPersona(userId, personaId);

    return toPrivatePersonaView(persona);
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
    await this.assertOwner(userId, personaId);

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

    const persona = await this.prismaService.persona.update({
      where: {
        id: personaId,
      },
      data,
      select: privatePersonaSelect,
    });

    return toPrivatePersonaView(persona);
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
        smartCardConfig:
          smartCardConfig === null
            ? Prisma.DbNull
            : (smartCardConfig as unknown as Prisma.InputJsonValue),
        publicPhone: publicActionFields.publicPhone,
        publicWhatsappNumber: publicActionFields.publicWhatsappNumber,
        publicEmail: publicActionFields.publicEmail,
      },
      select: privatePersonaSelect,
    });

    return toPrivatePersonaView(persona);
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
  ): Promise<boolean> {
    const activeProfileQr = await this.prismaService.qRAccessToken.findFirst({
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
