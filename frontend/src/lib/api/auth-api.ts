import type {
  AuthCredentials,
  LoginResult,
  ResendVerificationEmailInput,
  ResendVerificationEmailResult,
  SignupResult,
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
  getSession: () =>
    apiRequest<import("@/types/auth").SessionSnapshot>("/api/auth/session", {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
