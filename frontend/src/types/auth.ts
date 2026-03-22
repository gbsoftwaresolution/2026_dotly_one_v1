import type { UserProfile } from "./user";

export type MobileOtpEnrollmentPurpose = "ENROLLMENT";

export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordResult {
  accepted: boolean;
  resetEmailSent: boolean;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface PasswordMutationResult {
  success: boolean;
  signedOutSessions: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface RequestMobileOtpInput {
  phoneNumber: string;
}

export interface RequestMobileOtpResult {
  status: "sent";
  challengeId: string;
  purpose: MobileOtpEnrollmentPurpose;
  phoneNumber: string;
  resendAvailableAt: string;
  expiresAt: string;
  deliveryAvailable: boolean;
}

export interface VerifyMobileOtpInput {
  challengeId: string;
  code: string;
}

export interface VerifyMobileOtpResult {
  verified: boolean;
  phoneNumber: string;
  verifiedAt: string;
}

export interface SessionListResult {
  sessions: import("./user").UserSessionSummary[];
}

export interface RevokeSessionInput {
  sessionId: string;
}

export interface RevokeSessionResult {
  success: boolean;
  revokedCount?: number;
  alreadyInactive?: boolean;
}

export interface SessionSnapshot {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  isVerified: boolean;
}

export interface SignupResult {
  user: AuthUser;
  verificationPending: boolean;
  verificationEmailSent: boolean;
}

export interface LoginResult {
  success: boolean;
  sessionId?: string;
}

export interface VerifyEmailResult {
  verified: boolean;
  alreadyVerified: boolean;
  user: AuthUser;
}

export interface ResendVerificationEmailInput {
  email: string;
}

export interface ResendVerificationEmailResult {
  accepted: boolean;
  verificationPending: boolean;
  verificationEmailSent: boolean;
  mailDeliveryAvailable: boolean;
}
