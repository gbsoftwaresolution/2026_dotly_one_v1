import type { ContactRequestSourceType } from "./request";

export type ContactRelationshipState =
  | "approved"
  | "instant_access"
  | "expired";

export interface ContactTargetPersona {
  id: string;
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
}

export interface ContactTargetPersonaDetail extends ContactTargetPersona {
  accessMode: "open" | "request" | "private";
}

export interface ContactMemory {
  metAt: string;
  sourceLabel: string | null;
  note: string | null;
}

export interface Contact {
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  accessEndAt: string | null;
  sourceType: ContactRequestSourceType;
  targetPersona: ContactTargetPersona;
  memory: ContactMemory;
}

export interface ContactDetail {
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  accessStartAt: string | null;
  accessEndAt: string | null;
  isExpired: boolean;
  sourceType: ContactRequestSourceType;
  targetPersona: ContactTargetPersonaDetail;
  memory: ContactMemory;
}

export interface UpdateContactNoteInput {
  note: string | null;
}

export interface UpdateContactNoteResult {
  relationshipId: string;
  note: string | null;
}

export interface UpdateRelationshipStateResult {
  relationshipId: string;
  state: ContactRelationshipState;
}
