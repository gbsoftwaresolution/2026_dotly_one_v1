export type PersonaType = "personal" | "professional" | "business";

export type PersonaAccessMode = "open" | "request" | "private";

export type PersonaSharingMode = "controlled" | "smart_card";

export type PersonaSmartCardPrimaryAction =
  | "request_access"
  | "instant_connect"
  | "contact_me";

export interface PersonaSmartCardActionState {
  requestAccessEnabled: boolean;
  instantConnectEnabled: boolean;
  contactMeEnabled: boolean;
}

export interface PersonaSmartCardActions {
  call: boolean;
  whatsapp: boolean;
  email: boolean;
  vcard: boolean;
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

export interface PublicProfilePublicActions {
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
}

export interface PublicProfileSmartCard extends PersonaSmartCardConfig {
  actionState: PersonaSmartCardActionState;
  actions: PersonaSmartCardActions;
  actionLinks: PersonaSmartCardActionLinks;
}

export interface PersonaSummary {
  id: string;
  type: PersonaType;
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
  accessMode: PersonaAccessMode;
  verifiedOnly: boolean;
  sharingMode: PersonaSharingMode;
  smartCardConfig: PersonaSmartCardConfig | null;
  publicPhone: string | null;
  publicWhatsappNumber: string | null;
  publicEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  type: PersonaType;
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  accessMode: PersonaAccessMode;
  verifiedOnly?: boolean;
}

export interface UpdatePersonaInput {
  fullName?: string;
  jobTitle?: string;
  companyName?: string;
  tagline?: string;
  accessMode?: PersonaAccessMode;
  verifiedOnly?: boolean;
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
  name: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhoto: string | null;
  profilePhotoUrl?: string | null;
  sharingMode: PersonaSharingMode;
  instantConnectUrl?: string | null;
  smartCard: PublicProfileSmartCard | null;
  smartCardConfig: PersonaSmartCardConfig | null;
  publicActions: PublicProfilePublicActions;
}

export interface PublicProfileRequestTarget {
  id: string;
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
  state: "instant_access";
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
