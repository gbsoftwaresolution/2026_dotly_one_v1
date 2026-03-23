import { PublicPersonaTrustDto } from "../../profiles/dto/public-persona.dto";

interface PublicAgencyAgentCardSource {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl: string | null;
  trust: PublicPersonaTrustDto;
}

export class PublicAgencyAgentCardDto {
  username!: string;

  publicUrl!: string;

  fullName!: string;

  jobTitle!: string;

  companyName!: string;

  tagline!: string;

  profilePhotoUrl!: string | null;

  trust!: PublicPersonaTrustDto;

  static fromRecord(
    agent: PublicAgencyAgentCardSource,
  ): PublicAgencyAgentCardDto {
    return {
      username: agent.username,
      publicUrl: agent.publicUrl,
      fullName: agent.fullName,
      jobTitle: agent.jobTitle,
      companyName: agent.companyName,
      tagline: agent.tagline,
      profilePhotoUrl: agent.profilePhotoUrl,
      trust: agent.trust,
    } satisfies PublicAgencyAgentCardDto;
  }
}
