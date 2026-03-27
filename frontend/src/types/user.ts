import type { MobileOtpEnrollmentPurpose } from "./auth";

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  lastUsedAt: string | null;
  deviceType?: "singleDevice" | "multiDevice" | null;
  backedUp?: boolean;
}

export type UserTrustRequirementKey =
  | "send_contact_request"
  | "create_profile_qr"
  | "create_quick_connect_qr"
  | "create_event"
  | "join_event"
  | "enable_event_discovery"
  | "view_event_participants";

export interface UserTrustRequirement {
  key: UserTrustRequirementKey;
  label: string;
  unlocked: boolean;
}

export interface UserMobileOtpEnrollment {
  challengeId: string;
  purpose: MobileOtpEnrollmentPurpose;
  maskedPhoneNumber: string;
  resendAvailableAt: string;
  expiresAt: string;
  canResend: boolean;
}

export interface UserTrustFactor {
  key: string;
  label: string;
  status: "active" | "inactive" | "planned";
  description: string;
}

export interface UserSessionSummary {
  id: string;
  deviceLabel: string;
  platformLabel: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface CurrentUserReferral {
  id: string;
  referralCode: string;
}

export type UserActivationMilestoneKey =
  | "firstPersonaCreated"
  | "firstQrOpened"
  | "firstShareCompleted"
  | "firstRequestReceived";

export type UserActivationNudgeQueue = "requests" | "inbox";

export interface UserActivationFirstResponseNudge {
  queue: UserActivationNudgeQueue;
  triggeredAt: string;
  clearedAt: string | null;
}

export interface UserActivationMilestones {
  firstPersonaCreatedAt: string | null;
  firstQrOpenedAt: string | null;
  firstShareCompletedAt: string | null;
  firstRequestReceivedAt: string | null;
}

export interface UserActivationState {
  milestones: UserActivationMilestones;
  completedCount: number;
  nextMilestoneKey: UserActivationMilestoneKey | null;
  firstResponseNudge?: UserActivationFirstResponseNudge | null;
}

export interface UserSecurityProfile {
  trustBadge: "verified" | "attention";
  maskedEmail: string;
  mailDeliveryAvailable: boolean;
  passwordResetAvailable: boolean;
  smsDeliveryAvailable: boolean;
  maskedPhoneNumber: string | null;
  phoneVerificationStatus: "not_enrolled" | "pending" | "verified";
  mobileOtpEnrollment: UserMobileOtpEnrollment | null;
  passkeyCount?: number;
  explanation: string;
  unlockedActions: string[];
  restrictedActions: string[];
  requirements: UserTrustRequirement[];
  trustFactors: UserTrustFactor[];
  passkeys?: UserPasskey[];
}

export interface UserProfile {
  id: string;
  email: string;
  isVerified: boolean;
  security: UserSecurityProfile;
  activation?: UserActivationState;
}
