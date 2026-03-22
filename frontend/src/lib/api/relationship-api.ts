import type { ApiResponse } from "@/types/api";
import type { InstantConnectResult } from "@/types/persona";

import { apiRequest } from "./client";

export const relationshipApi = {
  instantConnect: (username: string) =>
    apiRequest<InstantConnectResult>(
      `/api/public/${encodeURIComponent(username)}/instant-connect`,
      {
        method: "POST",
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
