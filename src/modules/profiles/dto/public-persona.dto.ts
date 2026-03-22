import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "@prisma/client";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import {
  buildPublicSmartCardResponse,
  type PersonaPublicSmartCardActions,
  type PersonaSmartCardActionState,
  type PersonaSmartCardActionLinks,
  type PersonaSmartCardConfig,
  toApiSharingMode,
} from "../../personas/persona-sharing";
import { buildPublicPersonaTrustSignals } from "../../personas/persona-trust";
import { canonicalizePublicUrl } from "../../personas/public-url";

interface PublicPersonaSource {
  id?: string;
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl: string | null;
  accessMode: PrismaPersonaAccessMode;
  sharingMode: PrismaPersonaSharingMode;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  businessVerified?: boolean;
  smartCardConfig: unknown;
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
}

export class PublicPersonaTrustDto {
  isVerified!: boolean;

  isStrongVerified!: boolean;

  isBusinessVerified!: boolean;

  static fromVerification(
    verification: Pick<
      PublicPersonaSource,
      "emailVerified" | "phoneVerified" | "businessVerified"
    >,
  ): PublicPersonaTrustDto {
    return buildPublicPersonaTrustSignals({
      emailVerified: verification.emailVerified ?? false,
      phoneVerified: verification.phoneVerified ?? false,
      businessVerified: verification.businessVerified ?? false,
    });
  }
}

export class PublicPersonaSmartCardActionStateDto {
  requestAccessEnabled!: boolean;

  instantConnectEnabled!: boolean;

  contactMeEnabled!: boolean;

  static fromState(
    actionState: PersonaSmartCardActionState,
  ): PublicPersonaSmartCardActionStateDto {
    return {
      requestAccessEnabled: actionState.requestAccessEnabled,
      instantConnectEnabled: actionState.instantConnectEnabled,
      contactMeEnabled: actionState.contactMeEnabled,
    } satisfies PublicPersonaSmartCardActionStateDto;
  }
}

export class PublicPersonaSmartCardActionLinksDto {
  call!: string | null;

  whatsapp!: string | null;

  email!: string | null;

  vcard!: string | null;

  static fromLinks(
    links: PersonaSmartCardActionLinks,
  ): PublicPersonaSmartCardActionLinksDto {
    return {
      call: links.call,
      whatsapp: links.whatsapp,
      email: links.email,
      vcard: links.vcard,
    } satisfies PublicPersonaSmartCardActionLinksDto;
  }
}

export class PublicPersonaSmartCardDto {
  primaryAction!: PersonaSmartCardConfig["primaryAction"];

  actionState!: PublicPersonaSmartCardActionStateDto;

  actionLinks!: PublicPersonaSmartCardActionLinksDto;

  static fromConfig(
    config: PersonaSmartCardConfig,
    actionState: PersonaSmartCardActionState,
    publicActions: PersonaPublicSmartCardActions,
  ): PublicPersonaSmartCardDto {
    return {
      primaryAction: config.primaryAction,
      actionState: PublicPersonaSmartCardActionStateDto.fromState(actionState),
      actionLinks: PublicPersonaSmartCardActionLinksDto.fromLinks(
        publicActions.actionLinks,
      ),
    } satisfies PublicPersonaSmartCardDto;
  }
}

export class PublicPersonaDto {
  username!: string;

  publicUrl!: string;

  fullName!: string;

  jobTitle!: string;

  companyName!: string;

  profilePhotoUrl!: string | null;

  tagline!: string;

  sharingMode!: PersonaSharingMode;

  instantConnectUrl!: string | null;

  smartCard!: PublicPersonaSmartCardDto | null;

  trust!: PublicPersonaTrustDto;

  static fromRecord(
    persona: PublicPersonaSource,
    options?: {
      instantConnectUrl?: string | null;
      actionState?: PersonaSmartCardActionState | null;
    },
  ): PublicPersonaDto {
    const sharingMode = toApiSharingMode(persona.sharingMode);
    const publicSmartCardResponse = buildPublicSmartCardResponse({
      username: persona.username,
      sharingMode: persona.sharingMode,
      smartCardConfig: persona.smartCardConfig,
      publicPhone: persona.publicPhone,
      publicWhatsappNumber: persona.publicWhatsappNumber,
      publicEmail: persona.publicEmail,
    });
    const safeSmartCardConfig = publicSmartCardResponse.smartCardConfig;
    const publicUrl = canonicalizePublicUrl(persona.publicUrl, persona.username);
    const smartCard =
      sharingMode === PersonaSharingMode.Controlled ||
      safeSmartCardConfig === null ||
      options?.actionState === null ||
      options?.actionState === undefined
        ? null
        : PublicPersonaSmartCardDto.fromConfig(
            safeSmartCardConfig,
            options.actionState,
            publicSmartCardResponse.smartCardActions,
          );

    return {
      username: persona.username,
      publicUrl,
      fullName: persona.fullName,
      jobTitle: persona.jobTitle,
      companyName: persona.companyName,
      profilePhotoUrl: persona.profilePhotoUrl ?? null,
      tagline: persona.tagline,
      sharingMode,
      instantConnectUrl: options?.instantConnectUrl ?? null,
      smartCard,
      trust: PublicPersonaTrustDto.fromVerification(persona),
    } satisfies PublicPersonaDto;
  }
}