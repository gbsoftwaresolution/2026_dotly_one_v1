import type { ApiResponse } from "@/types/api";

export const qrApi = {
  getCurrent: async () =>
    Promise.resolve<ApiResponse>({
      success: true,
      message: "QR placeholder.",
    }),
};
