export type PersonaType = "personal" | "professional" | "business";

export type PersonaAccessMode = "open" | "request" | "private";

export type PersonaSharingMode = "controlled" | "smart_card";

export type PersonaSharingConfigSource = "system_default" | "user_custom";

export type PersonaSmartCardPrimaryAction =
  | "request_access"
  | "instant_connect"
  | "contact_me";

export type PersonaSharePreferredShareType = "smart_card" | "instant_connect";

export interface PersonaShareEffectiveActions {
  canCall: boolean;
  canWhatsapp: boolean;
  canEmail: boolean;
  canSaveContact: boolean;
}

export interface PersonaSmartCardActionState {
  requestAccessEnabled: boolean;
  instantConnectEnabled: boolean;
  contactMeEnabled: boolean;
}

export interface PersonaSmartCardActionLinks {
  call: string | null;
  whatsapp: string | null;
  email: string | null;
  vcard: string | null;
}

export interface PersonaSmartCardConfig {
  primaryAction: PersonaSmartCardPrimaryAction;
  allowCall: boolean;
  allowWhatsapp: boolean;
  allowEmail: boolean;
  allowVcard: boolean;
  actionState?: PersonaSmartCardActionState | null;
}

export interface PublicProfileSmartCard {
  primaryAction: PersonaSmartCardPrimaryAction;
  actionState: PersonaSmartCardActionState;
  actionLinks: PersonaSmartCardActionLinks;
}

export interface PublicPersonaTrust {
  isVerified: boolean;
  isStrongVerified: boolean;
  isBusinessVerified: boolean;
}

export interface PersonaSharingCapabilities {
  hasActiveProfileQr: boolean;
  primaryActions: {
    requestAccess: boolean;
    instantConnect: boolean;
    contactMe: boolean;
  };
}

export interface PersonaSummary {
  id: string;
  identityId?: string | null;
  type: PersonaType;
  isPrimary?: boolean;
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string | null;
  tagline: string | null;
  websiteUrl?: string | null;
  isVerified?: boolean;
  profilePhotoUrl?: string | null;
  accessMode: PersonaAccessMode;
  verifiedOnly: boolean;
  sharingMode: PersonaSharingMode;
  sharingConfigSource?: PersonaSharingConfigSource | null;
  smartCardConfig: PersonaSmartCardConfig | null;
  sharingCapabilities?: PersonaSharingCapabilities;
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
  routingKey?: string | null;
  routingDisplayName?: string | null;
  isDefaultRouting?: boolean;
  routingRulesJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaFastSharePayload {
  personaId: string;
  username: string;
  fullName: string;
  profilePhotoUrl: string | null;
  shareUrl: string;
  qrValue: string;
  primaryAction: PersonaSmartCardPrimaryAction;
  effectiveActions: PersonaShareEffectiveActions;
  preferredShareType: PersonaSharePreferredShareType;
  hasQuickConnect: boolean;
  quickConnectUrl: string | null;
}

export interface MyFastSharePayload {
  persona: {
    id: string;
    username: string;
    fullName: string;
    profilePhotoUrl: string | null;
  } | null;
  share: {
    shareUrl: string;
    qrValue: string;
    primaryAction: PersonaSmartCardPrimaryAction;
    effectiveActions: PersonaShareEffectiveActions;
    preferredShareType: PersonaSharePreferredShareType;
  } | null;
}

export interface CreatePersonaInput {
  identityId?: string;
  type: PersonaType;
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  websiteUrl?: string;
  accessMode: PersonaAccessMode;
  verifiedOnly?: boolean;
  isVerified?: boolean;
  routingKey?: string;
  routingDisplayName?: string;
  isDefaultRouting?: boolean;
  routingRulesJson?: Record<string, unknown> | null;
}

export type PersonaUsernameAvailabilityCode =
  | "available"
  | "too_short"
  | "premium_short"
  | "too_long"
  | "invalid_characters"
  | "must_start_with_letter"
  | "cannot_end_with_separator"
  | "repeated_separator"
  | "reserved_system"
  | "reserved_brand"
  | "taken";

export interface PersonaUsernameAvailability {
  username: string;
  available: boolean;
  code: PersonaUsernameAvailabilityCode;
  message: string;
  requiresClaim: boolean;
}

export interface UpdatePersonaInput {
  identityId?: string;
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  tagline?: string;
  websiteUrl?: string;
  accessMode?: PersonaAccessMode;
  verifiedOnly?: boolean;
  isVerified?: boolean;
  routingKey?: string;
  routingDisplayName?: string;
  isDefaultRouting?: boolean;
  routingRulesJson?: Record<string, unknown> | null;
}

export interface UpdatePersonaSharingInput {
  sharingMode?: PersonaSharingMode;
  smartCardConfig?: PersonaSmartCardConfig | null;
  publicPhone?: string | null;
  publicWhatsappNumber?: string | null;
  publicEmail?: string | null;
}

export interface PublicProfile {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string | null;
  tagline: string | null;
  websiteUrl?: string | null;
  isVerified?: boolean;
  profilePhotoUrl?: string | null;
  sharingMode: PersonaSharingMode;
  instantConnectUrl?: string | null;
  smartCard: PublicProfileSmartCard | null;
  trust: PublicPersonaTrust;
  socialLinks?: PersonaSocialLink[];
  socialLinksDisplayMode?: PersonaSocialLinksDisplayMode;
}

export interface InstantConnectResult {
  relationshipId: string;
  status: "connected";
}

export interface PublicInstantConnectInput {
  fromPersonaId: string;
}

export interface PublicProfileRequestTarget {
  username: string;
  fullName: string;
  accessMode: PersonaAccessMode;
}

export type QrType = "profile" | "quick_connect";

export interface QrTokenSummary {
  id: string;
  code: string;
  type: QrType;
  url: string;
}

export interface QuickConnectQrInput {
  durationHours: number;
  maxUses?: number;
}

export interface QuickConnectQrSummary extends QrTokenSummary {
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
}

export interface ConnectQuickConnectQrInput {
  fromPersonaId: string;
}

export interface QuickConnectTargetPersona {
  id: string;
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
}

export interface ConnectQuickConnectQrResult {
  relationshipId: string;
  status: "connected";
  accessStartAt: string;
  accessEndAt: string;
  targetPersona: QuickConnectTargetPersona;
}

export interface ResolvedQrPersonaPreview {
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
}

export interface ResolvedProfileQr {
  type: "profile";
  code: string;
  persona: ResolvedQrPersonaPreview;
}

export interface ResolvedQuickConnectQr {
  type: "quick_connect";
  code: string;
  persona: ResolvedQrPersonaPreview;
}

export type ResolvedQr = ResolvedProfileQr | ResolvedQuickConnectQr;

export type PersonaSocialLinksDisplayMode = "icons" | "list" | "buttons";

export interface PersonaSocialLink {
  id: string;
  url: string;
  title: string;
}
