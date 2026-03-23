import type { UserProfile } from "@/types/user";

import { apiRequest } from "./client";

export const userApi = {
  me: (token: string) =>
    apiRequest<UserProfile>("/users/me", {
      token,
    }),

  getCurrent: () =>
    apiRequest<UserProfile>("/api/users/me", {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
