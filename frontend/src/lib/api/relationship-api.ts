import type { ApiResponse } from "@/types/api";

export const relationshipApi = {
  list: async () =>
    Promise.resolve<ApiResponse<unknown[]>>({
      success: true,
      data: [],
      message: "Relationship list placeholder.",
    }),
};
