export type PersonaType = "personal" | "professional" | "business";

export type PersonaAccessMode = "open" | "request" | "private";

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
}

export interface PublicProfile {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
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

export interface ResolvedQrPersonaPreview {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
  accessMode: PersonaAccessMode;
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
  quickConnect: {
    startsAt: string;
    endsAt: string;
    maxUses: number | null;
    usedCount: number;
  };
}

export type ResolvedQr = ResolvedProfileQr | ResolvedQuickConnectQr;
