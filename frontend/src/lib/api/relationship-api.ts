import type { ApiResponse } from "@/types/api";
import type {
  InstantConnectResult,
  PublicInstantConnectInput,
} from "@/types/persona";

import { apiRequest } from "./client";

export const relationshipApi = {
  instantConnect: (
    publicIdentifier: string,
    payload: PublicInstantConnectInput,
    options?: { signal?: AbortSignal; requestKey?: string },
  ) =>
    apiRequest<InstantConnectResult>(
      `/api/public/${encodeURIComponent(publicIdentifier)}/instant-connect`,
      {
        method: "POST",
        body: payload,
        baseUrl: "",
        credentials: "same-origin",
        signal: options?.signal,
        headers: options?.requestKey
          ? {
              "x-idempotency-key": options.requestKey,
            }
          : undefined,
      },
    ),
  list: async () =>
    Promise.resolve<ApiResponse<unknown[]>>({
      success: true,
      data: [],
      message: "Relationship list placeholder.",
    }),
};
