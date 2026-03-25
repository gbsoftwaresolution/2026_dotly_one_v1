import { apiClient } from "./client";
import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  RefreshTokenResponse,
  User,
} from "../types/user";
import type {
  ChangePasswordDto,
  VerifyPasswordDto,
} from "@booster-vault/shared";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>("/v1/auth/login", credentials);
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>("/v1/auth/register", data);
  },

  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    return apiClient.post<RefreshTokenResponse>("/v1/auth/refresh", {
      refreshToken,
    });
  },

  logout: async (): Promise<void> => {
    return apiClient.post("/v1/auth/logout");
  },

  changePassword: async (data: ChangePasswordDto): Promise<void> => {
    return apiClient.post("/v1/auth/change-password", data);
  },

  verifyEmail: async (token: string): Promise<void> => {
    return apiClient.post("/v1/auth/verify-email", { token });
  },

  requestEmailVerification: async (email: string): Promise<void> => {
    return apiClient.post("/v1/auth/request-email-verification", { email });
  },

  forgotPassword: async (email: string): Promise<void> => {
    return apiClient.post("/v1/auth/forgot-password", { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    return apiClient.post("/v1/auth/reset-password", { token, newPassword });
  },

  verifyPassword: async (
    dto: VerifyPasswordDto,
  ): Promise<{ valid: boolean }> => {
    return apiClient.post<{ valid: boolean }>("/v1/auth/verify-password", dto);
  },

  getCurrentUser: async (): Promise<User> => {
    const raw = await apiClient.get<any>("/v1/me");
    const response: any = raw?.user ?? raw;
    return {
      id: response.id,
      email: response.email,
      displayName: response.displayName,
      locale: response.locale,
      timezone: response.timezone,
      emailVerified: response.emailVerified ?? response.isEmailVerified,
      trialEndsAt: response.trialEndsAt,
      subscriptionStatus: response.subscriptionStatus,
      currentPlanCode: response.currentPlanCode,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  },
};
