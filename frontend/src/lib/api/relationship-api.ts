import type { ApiResponse } from "@/types/api";
import type {
  InstantConnectResult,
  PublicInstantConnectInput,
} from "@/types/persona";

import { apiRequest } from "./client";

export const relationshipApi = {
  instantConnect: (username: string, payload: PublicInstantConnectInput) =>
    apiRequest<InstantConnectResult>(
      `/api/public/${encodeURIComponent(username)}/instant-connect`,
      {
        method: "POST",
        body: payload,
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
  list: async () =>
    Promise.resolve<ApiResponse<unknown[]>>({
      success: true,
      data: [],
      message: "Relationship list placeholder.",
    }),
};
