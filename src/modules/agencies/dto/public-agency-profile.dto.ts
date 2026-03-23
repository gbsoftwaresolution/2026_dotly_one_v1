interface PublicAgencyProfileSource {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
}

export class PublicAgencyProfileDto {
  name!: string;

  slug!: string;

  tagline!: string | null;

  description!: string | null;

  logoUrl!: string | null;

  static fromRecord(agency: PublicAgencyProfileSource): PublicAgencyProfileDto {
    return {
      name: agency.name,
      slug: agency.slug,
      tagline: agency.tagline,
      description: agency.description,
      logoUrl: agency.logoUrl,
    } satisfies PublicAgencyProfileDto;
  }
}
