export interface SessionSnapshot {
  user: AuthUser | null;
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
}
