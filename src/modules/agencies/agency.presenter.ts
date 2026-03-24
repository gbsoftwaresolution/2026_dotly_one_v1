import {
  AgencyProfileStatus as PrismaAgencyProfileStatus,
  Prisma,
} from "../../generated/prisma/client";

import { AgencyProfileStatus } from "../../common/enums/agency-profile-status.enum";
import { canonicalizePublicUrl } from "../personas/public-url";
import { PublicPersonaTrustDto } from "../profiles/dto/public-persona.dto";

import { PublicAgencyAgentCardDto } from "./dto/public-agency-agent-card.dto";
import { PublicAgencyProfileDto } from "./dto/public-agency-profile.dto";
import { PrivateAgencyProfileDto } from "./dto/private-agency-profile.dto";

export const privateAgencyProfileSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  logoUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgencyProfileSelect;

export type PrivateAgencyProfileRecord = Prisma.AgencyProfileGetPayload<{
  select: typeof privateAgencyProfileSelect;
}>;

export const publicAgencyProfileSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  logoUrl: true,
} satisfies Prisma.AgencyProfileSelect;

export type PublicAgencyProfileRecord = Prisma.AgencyProfileGetPayload<{
  select: typeof publicAgencyProfileSelect;
}>;

export const publicAgencyAgentSelect = {
  username: true,
  publicUrl: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  tagline: true,
  profilePhotoUrl: true,
  emailVerified: true,
  phoneVerified: true,
  businessVerified: true,
  accessMode: true,
  sharingMode: true,
  smartCardConfig: true,
} satisfies Prisma.PersonaSelect;

export type PublicAgencyAgentRecord = Prisma.PersonaGetPayload<{
  select: typeof publicAgencyAgentSelect;
}>;

const apiAgencyProfileStatusMap: Record<
  PrismaAgencyProfileStatus,
  AgencyProfileStatus
> = {
  [PrismaAgencyProfileStatus.DRAFT]: AgencyProfileStatus.Draft,
  [PrismaAgencyProfileStatus.ACTIVE]: AgencyProfileStatus.Active,
  [PrismaAgencyProfileStatus.ARCHIVED]: AgencyProfileStatus.Archived,
};

export function toPrismaAgencyProfileStatus(
  status: AgencyProfileStatus,
): PrismaAgencyProfileStatus {
  switch (status) {
    case AgencyProfileStatus.Draft:
      return PrismaAgencyProfileStatus.DRAFT;
    case AgencyProfileStatus.Active:
      return PrismaAgencyProfileStatus.ACTIVE;
    case AgencyProfileStatus.Archived:
      return PrismaAgencyProfileStatus.ARCHIVED;
  }
}

export function toPrivateAgencyProfileView(
  agency: PrivateAgencyProfileRecord,
): PrivateAgencyProfileDto {
  return PrivateAgencyProfileDto.fromRecord({
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    tagline: agency.tagline,
    description: agency.description,
    logoUrl: agency.logoUrl,
    status: apiAgencyProfileStatusMap[agency.status],
    createdAt: agency.createdAt,
    updatedAt: agency.updatedAt,
  });
}

export function toPublicAgencyProfileView(
  agency: PublicAgencyProfileRecord,
): PublicAgencyProfileDto {
  return PublicAgencyProfileDto.fromRecord(agency);
}

export function toPublicAgencyAgentCardView(
  persona: Pick<
    PublicAgencyAgentRecord,
    | "username"
    | "publicUrl"
    | "fullName"
    | "jobTitle"
    | "companyName"
    | "tagline"
    | "profilePhotoUrl"
    | "emailVerified"
    | "phoneVerified"
    | "businessVerified"
  >,
): PublicAgencyAgentCardDto {
  return PublicAgencyAgentCardDto.fromRecord({
    username: persona.username,
    publicUrl: canonicalizePublicUrl(persona.publicUrl, persona.username),
    fullName: persona.fullName,
    jobTitle: persona.jobTitle,
    companyName: persona.companyName,
    tagline: persona.tagline,
    profilePhotoUrl: persona.profilePhotoUrl,
    trust: PublicPersonaTrustDto.fromVerification({
      emailVerified: persona.emailVerified ?? false,
      phoneVerified: persona.phoneVerified ?? false,
      businessVerified: persona.businessVerified ?? false,
    }),
  });
}
