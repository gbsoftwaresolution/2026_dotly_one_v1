import { AgencyProfileStatus } from "../../../common/enums/agency-profile-status.enum";

interface PrivateAgencyProfileSource {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  status: AgencyProfileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class PrivateAgencyProfileDto {
  id!: string;

  name!: string;

  slug!: string;

  tagline!: string | null;

  description!: string | null;

  logoUrl!: string | null;

  status!: AgencyProfileStatus;

  createdAt!: Date;

  updatedAt!: Date;

  static fromRecord(
    agency: PrivateAgencyProfileSource,
  ): PrivateAgencyProfileDto {
    return {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      tagline: agency.tagline,
      description: agency.description,
      logoUrl: agency.logoUrl,
      status: agency.status,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    } satisfies PrivateAgencyProfileDto;
  }
}
