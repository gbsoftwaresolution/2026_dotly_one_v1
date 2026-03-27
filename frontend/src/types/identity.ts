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

export type IdentityMemberRole = "MEMBER" | "MANAGER" | "OWNER";

export type IdentityOperatorRole = "OPERATOR" | "ADMIN" | "SUPER_ADMIN";

export type IdentityTeamAccessMode = "full" | "restricted";

export interface IdentityTeamAccessPersona {
  id: string;
  username: string;
  fullName: string;
  routingKey: string | null;
  routingDisplayName: string | null;
  isDefaultRouting: boolean;
}

export interface IdentityTeamAccessEntry {
  id: string;
  personId: string;
  email: string | null;
  role: IdentityMemberRole | IdentityOperatorRole;
  status: string;
  assignedPersonaIds: string[];
  assignedPersonas: IdentityTeamAccessPersona[];
  accessMode: IdentityTeamAccessMode;
}

export interface IdentityTeamAccessPayload {
  identity: {
    id: string;
    displayName: string;
    handle: string | null;
  };
  personas: IdentityTeamAccessPersona[];
  members: IdentityTeamAccessEntry[];
  operators: IdentityTeamAccessEntry[];
}
