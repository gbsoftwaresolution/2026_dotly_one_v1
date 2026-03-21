import type {
  AuthCredentials,
  ChangePasswordInput,
  ForgotPasswordInput,
  ForgotPasswordResult,
  LoginResult,
  PasswordMutationResult,
  RequestMobileOtpInput,
  RequestMobileOtpResult,
  ResendVerificationEmailInput,
  ResendVerificationEmailResult,
  ResetPasswordInput,
  RevokeSessionInput,
  RevokeSessionResult,
  SessionListResult,
  SignupResult,
  VerifyMobileOtpInput,
  VerifyMobileOtpResult,
  VerifyEmailResult,
} from "@/types/auth";

import { apiRequest } from "./client";

export const authApi = {
  signup: (credentials: AuthCredentials) =>
    apiRequest<SignupResult>("/api/auth/signup", {
      method: "POST",
      body: credentials,
      baseUrl: "",
      credentials: "same-origin",
    }),
  login: (credentials: AuthCredentials) =>
    apiRequest<LoginResult>("/api/auth/login", {
      method: "POST",
      body: credentials,
      baseUrl: "",
      credentials: "same-origin",
    }),
  forgotPassword: (input: ForgotPasswordInput) =>
    apiRequest<ForgotPasswordResult>("/api/auth/forgot-password", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  resetPassword: (input: ResetPasswordInput) =>
    apiRequest<PasswordMutationResult>("/api/auth/reset-password", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  logout: () =>
    apiRequest<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),
  verifyEmail: (token: string) =>
    apiRequest<VerifyEmailResult>("/api/auth/verify-email", {
      method: "POST",
      body: { token },
      baseUrl: "",
      credentials: "same-origin",
    }),
  resendVerificationEmail: (input: ResendVerificationEmailInput) =>
    apiRequest<ResendVerificationEmailResult>("/api/auth/verify-email/resend", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  resendCurrentUserVerificationEmail: () =>
    apiRequest<ResendVerificationEmailResult>(
      "/api/users/me/verification/resend",
      {
        method: "POST",
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
  changePassword: (input: ChangePasswordInput) =>
    apiRequest<PasswordMutationResult>("/api/users/me/password/change", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  requestMobileOtp: (input: RequestMobileOtpInput) =>
    apiRequest<RequestMobileOtpResult>("/api/users/me/mobile-otp/request", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  verifyMobileOtp: (input: VerifyMobileOtpInput) =>
    apiRequest<VerifyMobileOtpResult>("/api/users/me/mobile-otp/verify", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  listSessions: () =>
    apiRequest<SessionListResult>("/api/users/me/sessions", {
      baseUrl: "",
      credentials: "same-origin",
    }),
  revokeSession: (input: RevokeSessionInput) =>
    apiRequest<RevokeSessionResult>("/api/users/me/sessions/revoke", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  revokeOtherSessions: () =>
    apiRequest<RevokeSessionResult>("/api/users/me/sessions/revoke-others", {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),
  getSession: () =>
    apiRequest<import("@/types/auth").SessionSnapshot>("/api/auth/session", {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
