import type {
  PublicProfile,
  PublicProfileRequestTarget,
} from "@/types/persona";

import { apiRequest } from "./client";

export const publicApi = {
  getProfile: (username: string, headers?: HeadersInit) =>
    apiRequest<PublicProfile>(`/public/${encodeURIComponent(username)}`, {
      headers,
    }),
  getRequestTarget: (username: string) =>
    apiRequest<PublicProfileRequestTarget>(
      `/api/public/${encodeURIComponent(username)}/request-target`,
      {
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};
