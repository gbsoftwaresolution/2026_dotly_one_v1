export enum ConversationType {
  Direct = "DIRECT",
  ProtectedDirect = "PROTECTED_DIRECT",
  BusinessDirect = "BUSINESS_DIRECT",
}

export enum ConversationStatus {
  Active = "ACTIVE",
  Archived = "ARCHIVED",
  Blocked = "BLOCKED",
  Locked = "LOCKED",
}

export interface IdentityConversationContext {
  conversationId: string;
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  conversationType: ConversationType;
  conversationStatus: ConversationStatus;
  title: string | null;
  metadataJson: Record<string, unknown> | null;
  lastResolvedAt: string | null;
  lastPermissionHash: string | null;
  createdByIdentityId: string;
  createdAt: string;
  updatedAt: string;
}
