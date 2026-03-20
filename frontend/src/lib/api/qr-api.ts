import type {
  QrTokenSummary,
  QuickConnectQrInput,
  QuickConnectQrSummary,
  ResolvedQr,
} from "@/types/persona";

import { apiRequest } from "./client";

export const qrApi = {
  createProfileQr: (personaId: string) =>
    apiRequest<QrTokenSummary>(`/api/personas/${personaId}/qr/profile`, {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),
  createQuickConnectQr: (personaId: string, payload: QuickConnectQrInput) =>
    apiRequest<QuickConnectQrSummary>(
      `/api/personas/${personaId}/qr/quick-connect`,
      {
        method: "POST",
        body: payload,
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
  resolveQr: (code: string) =>
    apiRequest<ResolvedQr>(`/qr/${encodeURIComponent(code)}`),
};
