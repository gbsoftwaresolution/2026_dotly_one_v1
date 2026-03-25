import { apiClient } from "./client";
import type { User } from "../types/user";

export const usersApi = {
  getMe: async (): Promise<{ user: User }> => {
    return apiClient.get("/v1/me");
  },

  updateProfile: async (data: {
    displayName?: string;
    locale?: string;
    timezone?: string;
  }): Promise<{ user: User }> => {
    return apiClient.patch("/v1/me", data);
  },
};
