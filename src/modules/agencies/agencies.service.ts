import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AgencyProfileStatus as PrismaAgencyProfileStatus,
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  Prisma,
} from "../../generated/prisma/client";

import { AgencyProfileStatus } from "../../common/enums/agency-profile-status.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";

import {
  privateAgencyProfileSelect,
  publicAgencyAgentSelect,
  publicAgencyProfileSelect,
  toPublicAgencyAgentCardView,
  toPublicAgencyProfileView,
  toPrismaAgencyProfileStatus,
  toPrivateAgencyProfileView,
  type PrivateAgencyProfileRecord,
} from "./agency.presenter";
import { slugifyAgencySegment } from "./agency-slug";
import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { PublicAgencyAgentsDto } from "./dto/public-agency-agents.dto";
import { UpdateAgencyProfileDto } from "./dto/update-agency-profile.dto";
import {
  getSharingConfigSource,
  toSafeSmartCardConfig,
} from "../personas/persona-sharing";

@Injectable()
export class AgenciesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createMyAgencyProfile(userId: string, dto: CreateAgencyProfileDto) {
    const existingAgency = await this.prismaService.agencyProfile.findFirst({
      where: {
        ownerUserId: userId,
      },
      select: {
        id: true,
      },
    });

    if (existingAgency) {
      throw new ConflictException(
        "You already have an agency profile for this account",
      );
    }

    const slug = this.resolveCreateSlug(dto);

    try {
      const agency = await this.prismaService.agencyProfile.create({
        data: {
          ownerUserId: userId,
          name: dto.name,
          slug,
          tagline: dto.tagline ?? null,
          description: dto.description ?? null,
          logoUrl: dto.logoUrl ?? null,
          status: toPrismaAgencyProfileStatus(
            dto.status ?? AgencyProfileStatus.Draft,
          ),
        },
        select: privateAgencyProfileSelect,
      });

      return toPrivateAgencyProfileView(agency);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async findMyAgencyProfile(userId: string) {
    const agency = await this.findOwnedAgencyProfileOrThrow(userId);

    return toPrivateAgencyProfileView(agency);
  }

  async findPublicAgencyProfile(slug: string) {
    const agency = await this.findActivePublicAgencyProfileOrThrow(slug);

    return toPublicAgencyProfileView(agency);
  }

  async findPublicAgencyAgents(slug: string): Promise<PublicAgencyAgentsDto> {
    const agency = await this.findActivePublicAgencyProfileOrThrow(slug);
    const agents = await this.prismaService.persona.findMany({
      where: {
        agencyProfile: {
          slug: agency.slug,
          status: PrismaAgencyProfileStatus.ACTIVE,
        },
        accessMode: {
          in: [PrismaPersonaAccessMode.OPEN, PrismaPersonaAccessMode.REQUEST],
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: publicAgencyAgentSelect,
    });

    return {
      agency: toPublicAgencyProfileView(agency),
      agents: agents
        .filter((agent) => !this.needsSystemManagedSharingRepair(agent))
        .map((agent) => toPublicAgencyAgentCardView(agent)),
    } satisfies PublicAgencyAgentsDto;
  }

  async updateMyAgencyProfile(userId: string, dto: UpdateAgencyProfileDto) {
    const agency = await this.findOwnedAgencyProfileOrThrow(userId);

    try {
      const updatedAgency = await this.prismaService.agencyProfile.update({
        where: {
          id: agency.id,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined
            ? { slug: this.resolveUpdateSlug(dto) }
            : {}),
          ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
          ...(dto.status !== undefined
            ? { status: toPrismaAgencyProfileStatus(dto.status) }
            : {}),
        },
        select: privateAgencyProfileSelect,
      });

      return toPrivateAgencyProfileView(updatedAgency);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  private async findOwnedAgencyProfileOrThrow(
    userId: string,
  ): Promise<PrivateAgencyProfileRecord> {
    const agency = await this.prismaService.agencyProfile.findFirst({
      where: {
        ownerUserId: userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: privateAgencyProfileSelect,
    });

    if (!agency) {
      throw new NotFoundException("Agency profile not found");
    }

    return agency;
  }

  private async findActivePublicAgencyProfileOrThrow(slug: string) {
    const agency = await this.prismaService.agencyProfile.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: PrismaAgencyProfileStatus.ACTIVE,
      },
      select: publicAgencyProfileSelect,
    });

    if (!agency) {
      throw new NotFoundException("Agency profile not found");
    }

    return agency;
  }

  private resolveCreateSlug(dto: CreateAgencyProfileDto): string {
    const normalizedSlug =
      typeof dto.slug === "string" && dto.slug.length > 0
        ? slugifyAgencySegment(dto.slug)
        : slugifyAgencySegment(dto.name);

    if (normalizedSlug.length === 0) {
      throw new BadRequestException("Agency slug is invalid");
    }

    return normalizedSlug;
  }

  private resolveUpdateSlug(dto: UpdateAgencyProfileDto): string {
    const normalizedSlug =
      typeof dto.slug === "string" ? slugifyAgencySegment(dto.slug) : "";

    if (normalizedSlug.length === 0) {
      throw new BadRequestException("Agency slug is invalid");
    }

    return normalizedSlug;
  }

  private needsSystemManagedSharingRepair(
    persona: Pick<
      Prisma.PersonaGetPayload<{
        select: typeof publicAgencyAgentSelect;
      }>,
      "sharingMode" | "smartCardConfig"
    >,
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

  private rethrowUniqueConstraint(error: unknown): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Agency slug already in use");
    }
  }
}
