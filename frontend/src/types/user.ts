import type { MobileOtpEnrollmentPurpose } from "./auth";

export interface UserTrustRequirement {
  key: string;
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

export interface UserSecurityProfile {
  trustBadge: "verified" | "attention";
  maskedEmail: string;
  mailDeliveryAvailable: boolean;
  passwordResetAvailable: boolean;
  smsDeliveryAvailable: boolean;
  maskedPhoneNumber: string | null;
  phoneVerificationStatus: "not_enrolled" | "pending" | "verified";
  mobileOtpEnrollment: UserMobileOtpEnrollment | null;
  explanation: string;
  unlockedActions: string[];
  restrictedActions: string[];
  requirements: UserTrustRequirement[];
  trustFactors: UserTrustFactor[];
}

export interface UserProfile {
  id: string;
  email: string;
  isVerified: boolean;
  security: UserSecurityProfile;
}
