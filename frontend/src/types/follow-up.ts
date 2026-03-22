export type FollowUpStatus = "pending" | "completed" | "cancelled";

export interface FollowUpTargetPersona {
  id: string;
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  profilePhotoUrl?: string | null;
}

export interface FollowUpRelationship {
  relationshipId: string;
  targetPersona: FollowUpTargetPersona;
}

export interface FollowUp {
  id: string;
  relationshipId: string;
  remindAt: string;
  status: FollowUpStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  relationship: FollowUpRelationship;
}

export interface CreateFollowUpInput {
  relationshipId: string;
  remindAt: string;
  note?: string | null;
}

export interface UpdateFollowUpInput {
  remindAt?: string;
  note?: string | null;
}

export interface FollowUpListQuery {
  status?: FollowUpStatus;
  relationshipId?: string;
  upcoming?: boolean;
}