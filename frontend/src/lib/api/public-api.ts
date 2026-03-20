import type { PublicProfile } from "@/types/persona";

import { apiRequest } from "./client";

export const publicApi = {
  getProfile: (username: string, headers?: HeadersInit) =>
    apiRequest<PublicProfile>(`/public/${encodeURIComponent(username)}`, {
      headers,
    }),
};
