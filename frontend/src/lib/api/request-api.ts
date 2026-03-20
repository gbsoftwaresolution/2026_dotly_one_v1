import type { ApiResponse } from "@/types/api";

export const requestApi = {
  list: async () =>
    Promise.resolve<ApiResponse<unknown[]>>({
      success: true,
      data: [],
      message: "Request list placeholder.",
    }),
};
