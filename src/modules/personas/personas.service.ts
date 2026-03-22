import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PersonaSharingMode as PrismaPersonaSharingMode, Prisma } from "@prisma/client";

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
  toPrismaSharingMode,
  validateSmartCardConfig,
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
        sharingMode: true,
        smartCardConfig: true,
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

    const smartCardConfig =
      nextSharingMode === PrismaPersonaSharingMode.CONTROLLED
        ? null
        : (() => {
            if (requestedConfig === null || requestedConfig === undefined) {
              throw new BadRequestException(
                "smartCardConfig is required when sharingMode is smart_card",
              );
            }

            return validateSmartCardConfig(requestedConfig);
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
}
