export enum IdentityType {
  Personal = "personal",
  Professional = "professional",
  Business = "business",
  Couple = "couple",
  Family = "family",
}

export const enabledIdentityTypes = [
  IdentityType.Personal,
  IdentityType.Professional,
  IdentityType.Business,
] as const;

export type IdentityVerificationLevel = string;
export type IdentityLifecycleStatus = string;

export interface Identity {
  id: string;
  personId?: string | null;
  identityType: IdentityType;
  displayName: string;
  handle?: string | null;
  verificationLevel: IdentityVerificationLevel;
  status: IdentityLifecycleStatus;
  metadataJson?: Record<string, unknown> | null;
}

export interface CreateIdentityRequest {
  personId?: string;
  identityType: IdentityType;
  displayName: string;
  handle?: string;
  verificationLevel: IdentityVerificationLevel;
  status: IdentityLifecycleStatus;
  metadataJson?: Record<string, unknown>;
}
