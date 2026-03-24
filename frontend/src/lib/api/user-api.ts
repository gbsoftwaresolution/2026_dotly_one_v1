import type { CurrentUserAnalytics } from "@/types/analytics";
import type { CurrentUserReferral, UserProfile } from "@/types/user";

import { apiRequest } from "./client";

export const userApi = {
  me: (token: string) =>
    apiRequest<UserProfile>("/users/me", {
      token,
    }),

  meReferral: (token: string) =>
    apiRequest<CurrentUserReferral>("/users/me/referral", {
      token,
    }),

  meAnalytics: (token: string) =>
    apiRequest<CurrentUserAnalytics>("/me/analytics", {
      token,
    }),

  getCurrent: () =>
    apiRequest<UserProfile>("/api/users/me", {
      baseUrl: "",
      credentials: "same-origin",
    }),

  getCurrentReferral: () =>
    apiRequest<CurrentUserReferral>("/api/users/me/referral", {
      baseUrl: "",
      credentials: "same-origin",
    }),

  getCurrentAnalytics: () =>
    apiRequest<CurrentUserAnalytics>("/api/users/me/analytics", {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
