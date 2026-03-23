import type {
  ConnectQuickConnectQrInput,
  ConnectQuickConnectQrResult,
  QuickConnectQrInput,
  QuickConnectQrSummary,
  ResolvedQr,
} from "@/types/persona";

import { apiRequest } from "./client";

export const qrApi = {
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
  resolveQr: (code: string, headers?: HeadersInit) =>
    apiRequest<ResolvedQr>(`/qr/${encodeURIComponent(code)}`, {
      headers,
    }),
  connectQuick: (code: string, payload: ConnectQuickConnectQrInput) =>
    apiRequest<ConnectQuickConnectQrResult>(
      `/api/qr/${encodeURIComponent(code)}/connect`,
      {
        method: "POST",
        body: payload,
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};
