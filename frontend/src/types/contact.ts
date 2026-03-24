import type { ContactRequestSourceType } from "./request";

export type ContactRelationshipState =
  | "approved"
  | "instant_access"
  | "expired";

export type ContactConnectionSource = "qr" | "event" | "manual" | "unknown";

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
  hasPassiveInactivityFollowUp?: boolean;
  isTriggered?: boolean;
  isOverdue?: boolean;
  isUpcomingSoon?: boolean;
}

export type QuickInteractionType = "GREETING" | "FOLLOW_UP" | "THANK_YOU";

export type ContactRecentInteractionDirection = "sent" | "received";

export interface ContactRecentInteraction {
  id: string;
  type: QuickInteractionType;
  createdAt: string;
  direction: ContactRecentInteractionDirection;
}

export type RelationshipActivityTimelineEventType =
  | "CONNECTED"
  | "INTERACTION"
  | "FOLLOW_UP_CREATED"
  | "FOLLOW_UP_COMPLETED";

export interface RelationshipActivityTimelineEvent {
  id: string;
  type: RelationshipActivityTimelineEventType;
  label: string;
  timestamp: string;
}

export interface Contact {
  id?: string;
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  connectedAt: string;
  metAt: string;
  connectionSource: ContactConnectionSource;
  contextLabel: string | null;
  accessEndAt: string | null;
  lastInteractionAt: string | null;
  interactionCount: number;
  sourceType: ContactRequestSourceType;
  targetPersona: ContactTargetPersona;
  memory: ContactMemory;
  followUpSummary: ContactFollowUpSummary;
  metadata: ContactRelationshipMetadata;
}

export interface ContactDetail {
  relationshipId: string;
  state: ContactRelationshipState;
  createdAt: string;
  connectedAt: string;
  metAt: string;
  connectionSource: ContactConnectionSource;
  contextLabel: string | null;
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
  recentInteractions: ContactRecentInteraction[];
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

export interface CreateQuickInteractionInput {
  type: QuickInteractionType;
}

export interface CreateQuickInteractionResult {
  success: boolean;
}
