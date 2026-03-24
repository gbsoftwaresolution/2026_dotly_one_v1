import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaType as PrismaPersonaType,
  Prisma,
} from "../../generated/prisma/client";

import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";
import { PersonaType } from "../../common/enums/persona-type.enum";
import { PublicPersonaDto } from "../profiles/dto/public-persona.dto";
import {
  getSharingConfigSource,
  toApiSharingMode,
  toSafeSmartCardConfig,
} from "./persona-sharing";

export const privatePersonaSelect = {
  id: true,
  type: true,
  username: true,
  publicUrl: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  tagline: true,
  profilePhotoUrl: true,
  accessMode: true,
  verifiedOnly: true,
  emailVerified: true,
  phoneVerified: true,
  businessVerified: true,
  sharingMode: true,
  smartCardConfig: true,
  publicPhone: true,
  publicWhatsappNumber: true,
  publicEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const publicPersonaSelect = {
  id: true,
  userId: true,
  username: true,
  publicUrl: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  tagline: true,
  profilePhotoUrl: true,
  accessMode: true,
  sharingMode: true,
  emailVerified: true,
  phoneVerified: true,
  businessVerified: true,
  smartCardConfig: true,
  publicPhone: true,
  publicWhatsappNumber: true,
  publicEmail: true,
} as const;

export type PrivatePersonaRecord = Prisma.PersonaGetPayload<{
  select: typeof privatePersonaSelect;
}>;

export interface PrivatePersonaSharingCapabilities {
  hasActiveProfileQr: boolean;
  primaryActions: {
    requestAccess: boolean;
    instantConnect: boolean;
    contactMe: boolean;
  };
}

export type PublicPersonaRecord = Prisma.PersonaGetPayload<{
  select: typeof publicPersonaSelect;
}>;

const prismaPersonaTypeMap: Record<PersonaType, PrismaPersonaType> = {
  [PersonaType.Personal]: PrismaPersonaType.PERSONAL,
  [PersonaType.Professional]: PrismaPersonaType.PROFESSIONAL,
  [PersonaType.Business]: PrismaPersonaType.BUSINESS,
};

const prismaAccessModeMap: Record<PersonaAccessMode, PrismaPersonaAccessMode> =
  {
    [PersonaAccessMode.Open]: PrismaPersonaAccessMode.OPEN,
    [PersonaAccessMode.Request]: PrismaPersonaAccessMode.REQUEST,
    [PersonaAccessMode.Private]: PrismaPersonaAccessMode.PRIVATE,
  };

const apiPersonaTypeMap: Record<PrismaPersonaType, PersonaType> = {
  [PrismaPersonaType.PERSONAL]: PersonaType.Personal,
  [PrismaPersonaType.PROFESSIONAL]: PersonaType.Professional,
  [PrismaPersonaType.BUSINESS]: PersonaType.Business,
};

const apiAccessModeMap: Record<PrismaPersonaAccessMode, PersonaAccessMode> = {
  [PrismaPersonaAccessMode.OPEN]: PersonaAccessMode.Open,
  [PrismaPersonaAccessMode.REQUEST]: PersonaAccessMode.Request,
  [PrismaPersonaAccessMode.PRIVATE]: PersonaAccessMode.Private,
};

export function toPrismaPersonaType(type: PersonaType): PrismaPersonaType {
  return prismaPersonaTypeMap[type];
}

export function toPrismaAccessMode(
  accessMode: PersonaAccessMode,
): PrismaPersonaAccessMode {
  return prismaAccessModeMap[accessMode];
}

export function toPrivatePersonaView(
  persona: PrivatePersonaRecord,
  sharingCapabilities?: PrivatePersonaSharingCapabilities,
) {
  const sharingConfigSource =
    getSharingConfigSource(persona.smartCardConfig) ??
    (persona.sharingMode === "CONTROLLED" ? "system_default" : null);

  return {
    id: persona.id,
    type: apiPersonaTypeMap[persona.type],
    username: persona.username,
    publicUrl: persona.publicUrl,
    fullName: persona.fullName,
    jobTitle: persona.jobTitle,
    companyName: persona.companyName,
    tagline: persona.tagline,
    profilePhotoUrl: persona.profilePhotoUrl,
    accessMode: apiAccessModeMap[persona.accessMode],
    verifiedOnly: persona.verifiedOnly,
    sharingMode: toApiSharingMode(persona.sharingMode),
    sharingConfigSource,
    smartCardConfig: toSafeSmartCardConfig(persona.smartCardConfig),
    sharingCapabilities,
    publicPhone: persona.publicPhone,
    publicWhatsappNumber: persona.publicWhatsappNumber,
    publicEmail: persona.publicEmail,
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
  };
}

export function toPublicPersonaView(persona: PublicPersonaRecord) {
  return PublicPersonaDto.fromRecord(persona);
}
