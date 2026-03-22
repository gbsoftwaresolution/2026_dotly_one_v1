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

export interface ContactRelationshipMetadata {
  lastInteractionAt: string | null;
  interactionCount: number;
  hasInteractions: boolean;
  isRecentlyActive: boolean;
  relationshipAgeDays: number;
}

export interface ContactFollowUpSummary {
  hasPendingFollowUp: boolean;
  nextFollowUpAt: string | null;
  pendingFollowUpCount: number;
  isTriggered?: boolean;
  isOverdue?: boolean;
  isUpcomingSoon?: boolean;
}

export interface Contact {
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  accessEndAt: string | null;
  lastInteractionAt: string | null;
  interactionCount: number;
  sourceType: ContactRequestSourceType;
  targetPersona: ContactTargetPersona;
  memory: ContactMemory;
  metadata: ContactRelationshipMetadata;
}

export interface ContactDetail {
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  accessStartAt: string | null;
  accessEndAt: string | null;
  lastInteractionAt: string | null;
  interactionCount: number;
  isExpired: boolean;
  sourceType: ContactRequestSourceType;
  targetPersona: ContactTargetPersonaDetail;
  memory: ContactMemory;
  followUpSummary: ContactFollowUpSummary;
  metadata: ContactRelationshipMetadata;
}

export interface UpdateContactNoteInput {
  note: string | null;
}

export interface UpdateContactNoteResult {
  relationshipId: string;
  note: string | null;
  lastInteractionAt: string | null;
  interactionCount: number;
}

export interface UpdateRelationshipStateResult {
  relationshipId: string;
  state: ContactRelationshipState;
}
