import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
  PersonaType as PrismaPersonaType,
  Prisma,
} from "@prisma/client";

import { PersonaAccessMode } from "../../common/enums/persona-access-mode.enum";
import { PersonaSharingMode } from "../../common/enums/persona-sharing-mode.enum";
import { PersonaType } from "../../common/enums/persona-type.enum";
import {
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
  sharingMode: true,
  smartCardConfig: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PersonaSelect;

export const publicPersonaSelect = {
  id: true,
  username: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  tagline: true,
  profilePhotoUrl: true,
  sharingMode: true,
  smartCardConfig: true,
} satisfies Prisma.PersonaSelect;

export type PrivatePersonaRecord = Prisma.PersonaGetPayload<{
  select: typeof privatePersonaSelect;
}>;

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

export function toPrivatePersonaView(persona: PrivatePersonaRecord) {
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
    smartCardConfig: toSafeSmartCardConfig(persona.smartCardConfig),
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
  };
}

export function toPublicPersonaView(persona: PublicPersonaRecord) {
  return {
    username: persona.username,
    fullName: persona.fullName,
    jobTitle: persona.jobTitle,
    companyName: persona.companyName,
    tagline: persona.tagline,
    profilePhotoUrl: persona.profilePhotoUrl,
    sharingMode: toApiSharingMode(persona.sharingMode),
    smartCardConfig: toSafeSmartCardConfig(persona.smartCardConfig),
  };
}

export function buildPublicUrl(username: string): string {
  return `dotly.id/${username}`;
}
