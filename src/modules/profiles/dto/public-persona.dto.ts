import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "@prisma/client";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import {
  buildPublicSmartCardActions,
  buildSafePublicActionValues,
  type PersonaPublicActionValues,
  type PersonaSmartCardActionState,
  type PersonaSmartCardActionLinks,
  type PersonaSmartCardConfig,
  type PersonaSmartCardActions,
  type PersonaPublicSmartCardActions,
  toApiSharingMode,
  toSafeSmartCardConfig,
} from "../../personas/persona-sharing";

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
  smartCardConfig: unknown;
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
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

export class PublicPersonaSmartCardActionsDto {
  call!: boolean;

  whatsapp!: boolean;

  email!: boolean;

  vcard!: boolean;

  static fromActions(
    actions: PersonaSmartCardActions,
  ): PublicPersonaSmartCardActionsDto {
    return {
      call: actions.call,
      whatsapp: actions.whatsapp,
      email: actions.email,
      vcard: actions.vcard,
    } satisfies PublicPersonaSmartCardActionsDto;
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

export class PublicPersonaPublicActionsDto {
  phone!: string | null;

  whatsappNumber!: string | null;

  email!: string | null;

  static fromValues(
    values: PersonaPublicActionValues,
  ): PublicPersonaPublicActionsDto {
    return {
      phone: values.phone,
      whatsappNumber: values.whatsappNumber,
      email: values.email,
    } satisfies PublicPersonaPublicActionsDto;
  }
}

export class PublicPersonaSmartCardConfigDto {
  primaryAction!: PersonaSmartCardConfig["primaryAction"];

  allowCall!: boolean;

  allowWhatsapp!: boolean;

  allowEmail!: boolean;

  allowVcard!: boolean;

  static fromConfig(
    config: PersonaSmartCardConfig,
  ): PublicPersonaSmartCardConfigDto {
    return {
      primaryAction: config.primaryAction,
      allowCall: config.allowCall,
      allowWhatsapp: config.allowWhatsapp,
      allowEmail: config.allowEmail,
      allowVcard: config.allowVcard,
    } satisfies PublicPersonaSmartCardConfigDto;
  }
}

export class PublicPersonaSmartCardDto {
  primaryAction!: PersonaSmartCardConfig["primaryAction"];

  allowCall!: boolean;

  allowWhatsapp!: boolean;

  allowEmail!: boolean;

  allowVcard!: boolean;

  actionState!: PublicPersonaSmartCardActionStateDto;

  actions!: PublicPersonaSmartCardActionsDto;

  actionLinks!: PublicPersonaSmartCardActionLinksDto;

  static fromConfig(
    config: PersonaSmartCardConfig,
    actionState: PersonaSmartCardActionState,
    publicActions: PersonaPublicSmartCardActions,
  ): PublicPersonaSmartCardDto {
    return {
      ...PublicPersonaSmartCardConfigDto.fromConfig(config),
      actionState: PublicPersonaSmartCardActionStateDto.fromState(actionState),
      actions: PublicPersonaSmartCardActionsDto.fromActions(
        publicActions.actions,
      ),
      actionLinks: PublicPersonaSmartCardActionLinksDto.fromLinks(
        publicActions.actionLinks,
      ),
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

  instantConnectUrl!: string | null;

  smartCard!: PublicPersonaSmartCardDto | null;

  smartCardConfig!: PublicPersonaSmartCardConfigDto | null;

  publicActions!: PublicPersonaPublicActionsDto;

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

  static fromRecord(
    persona: PublicPersonaSource,
    options?: {
      instantConnectUrl?: string | null;
      actionState?: PersonaSmartCardActionState | null;
    },
  ): PublicPersonaDto {
    const sharingMode = toApiSharingMode(persona.sharingMode);
    const rawSmartCardConfig = toSafeSmartCardConfig(persona.smartCardConfig);
    const safeSmartCardConfig =
      sharingMode === PersonaSharingMode.SmartCard ? rawSmartCardConfig : null;
    const smartCardActions =
      safeSmartCardConfig === null
        ? {
            actions: {
              call: false,
              whatsapp: false,
              email: false,
              vcard: false,
            },
            actionLinks: {
              call: null,
              whatsapp: null,
              email: null,
              vcard: null,
            },
          }
        : buildPublicSmartCardActions({
            username: persona.username,
            smartCardConfig: safeSmartCardConfig,
            publicPhone: persona.publicPhone,
            publicWhatsappNumber: persona.publicWhatsappNumber,
            publicEmail: persona.publicEmail,
          });
    const publicActions =
      safeSmartCardConfig === null
        ? {
            phone: null,
            whatsappNumber: null,
            email: null,
          }
        : buildSafePublicActionValues({
            smartCardConfig: safeSmartCardConfig,
            publicPhone: persona.publicPhone,
            publicWhatsappNumber: persona.publicWhatsappNumber,
            publicEmail: persona.publicEmail,
          });
    const publicUrl = PublicPersonaDto.toCanonicalPublicUrl(
      persona.publicUrl,
      persona.username,
    );
    const smartCard =
      sharingMode === PersonaSharingMode.Controlled ||
      safeSmartCardConfig === null ||
      options?.actionState === null ||
      options?.actionState === undefined
        ? null
        : PublicPersonaSmartCardDto.fromConfig(
            safeSmartCardConfig,
            options.actionState,
            smartCardActions,
          );

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
        phoneNumber: null,
        email: null,
      },
      links: [],
      instantConnectUrl: options?.instantConnectUrl ?? null,
      smartCard,
      smartCardConfig:
        safeSmartCardConfig === null
          ? null
          : PublicPersonaSmartCardConfigDto.fromConfig(safeSmartCardConfig),
      publicActions: PublicPersonaPublicActionsDto.fromValues(publicActions),
    } satisfies PublicPersonaDto;
  }
}