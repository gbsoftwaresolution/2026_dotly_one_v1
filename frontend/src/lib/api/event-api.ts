import type { ApiResponse } from "@/types/api";

export const eventApi = {
  list: async () =>
    Promise.resolve<ApiResponse<unknown[]>>({
      success: true,
      data: [],
      message: "Event list placeholder.",
    }),
};
