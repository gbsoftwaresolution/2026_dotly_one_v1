import type {
  PublicProfile,
  PublicProfileRequestTarget,
} from "@/types/persona";

import { apiRequest } from "./client";

export const publicApi = {
  getProfile: (publicIdentifier: string, headers?: HeadersInit) =>
    apiRequest<PublicProfile>(
      `/public/${encodeURIComponent(publicIdentifier)}`,
      {
        headers,
      },
    ),
  getRequestTarget: (publicIdentifier: string) =>
    apiRequest<PublicProfileRequestTarget>(
      `/api/public/${encodeURIComponent(publicIdentifier)}/request-target`,
      {
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};
