import type { PublicProfile } from "@/types/persona";

import { apiRequest } from "./client";

export const publicApi = {
  getProfile: (username: string) =>
    apiRequest<PublicProfile>(`/public/${encodeURIComponent(username)}`),
};
