import { PersonaSharingMode as PrismaPersonaSharingMode } from "@prisma/client";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import {
  type PersonaSmartCardConfig,
  toApiSharingMode,
  toSafeSmartCardConfig,
} from "../../personas/persona-sharing";

interface PublicPersonaSource {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl: string | null;
  sharingMode: PrismaPersonaSharingMode;
  smartCardConfig: unknown;
  user?: {
    email: string;
    phoneNumber: string | null;
  } | null;
}

export class PublicPersonaChannelsDto {
  phoneNumber!: string | null;

  email!: string | null;
}

export class PublicPersonaLinkDto {
  label!: string;

  href!: string;

  kind!: "website" | "social";
}

export class PublicPersonaSmartCardDto {
  primaryAction!: PersonaSmartCardConfig["primaryAction"];

  allowCall!: boolean;

  allowWhatsapp!: boolean;

  allowEmail!: boolean;

  allowVcard!: boolean;

  static fromConfig(
    config: PersonaSmartCardConfig,
  ): PublicPersonaSmartCardDto {
    return {
      primaryAction: config.primaryAction,
      allowCall: config.allowCall,
      allowWhatsapp: config.allowWhatsapp,
      allowEmail: config.allowEmail,
      allowVcard: config.allowVcard,
    } satisfies PublicPersonaSmartCardDto;
  }
}

export class PublicPersonaDto {
  username!: string;

  publicUrl!: string;

  name!: string;

  fullName!: string;

  jobTitle!: string;

  companyName!: string;

  profilePhoto!: string | null;

  profilePhotoUrl!: string | null;

  tagline!: string;

  sharingMode!: PersonaSharingMode;

  channels!: PublicPersonaChannelsDto;

  links!: PublicPersonaLinkDto[];

  smartCard!: PublicPersonaSmartCardDto | null;

  smartCardConfig!: PublicPersonaSmartCardDto | null;

  private static toCanonicalPublicUrl(publicUrl: string, username: string): string {
    const trimmedPublicUrl = publicUrl.trim();

    if (trimmedPublicUrl.startsWith("http://") || trimmedPublicUrl.startsWith("https://")) {
      return trimmedPublicUrl;
    }

    if (trimmedPublicUrl.length > 0) {
      return `https://${trimmedPublicUrl.replace(/^\/+/, "")}`;
    }

    return `https://dotly.id/${username}`;
  }

  static fromRecord(persona: PublicPersonaSource): PublicPersonaDto {
    const sharingMode = toApiSharingMode(persona.sharingMode);
    const safeSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);
    const publicUrl = PublicPersonaDto.toCanonicalPublicUrl(
      persona.publicUrl,
      persona.username,
    );
    const canSharePhone = Boolean(
      safeSmartCardConfig &&
        (safeSmartCardConfig.allowCall ||
          safeSmartCardConfig.allowWhatsapp ||
          safeSmartCardConfig.allowVcard),
    );
    const canShareEmail = Boolean(
      safeSmartCardConfig &&
        (safeSmartCardConfig.allowEmail || safeSmartCardConfig.allowVcard),
    );
    const email = persona.user?.email ?? null;
    const phoneNumber = persona.user?.phoneNumber ?? null;
    const smartCard =
      sharingMode === PersonaSharingMode.Controlled ||
      safeSmartCardConfig === null
        ? null
        : PublicPersonaSmartCardDto.fromConfig(safeSmartCardConfig);

    return {
      username: persona.username,
      publicUrl,
      name: persona.fullName,
      fullName: persona.fullName,
      jobTitle: persona.jobTitle,
      companyName: persona.companyName,
      profilePhoto: persona.profilePhotoUrl ?? null,
      profilePhotoUrl: persona.profilePhotoUrl ?? null,
      tagline: persona.tagline,
      sharingMode,
      channels: {
        phoneNumber: canSharePhone ? phoneNumber : null,
        email: canShareEmail ? email : null,
      },
      links: [],
      smartCard,
      smartCardConfig:
        safeSmartCardConfig === null
          ? null
          : PublicPersonaSmartCardDto.fromConfig(safeSmartCardConfig),
    } satisfies PublicPersonaDto;
  }
}