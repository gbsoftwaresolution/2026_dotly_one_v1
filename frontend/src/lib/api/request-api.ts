import type {
  ApproveRequestResult,
  IncomingRequest,
  OutgoingRequest,
  RejectRequestResult,
  SendContactRequestInput,
  SendContactRequestResult,
} from "@/types/request";

import { apiRequest } from "./client";

export const requestApi = {
  sendRequest: (input: SendContactRequestInput) =>
    apiRequest<SendContactRequestResult>("/api/contact-requests", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  listIncoming: () =>
    apiRequest<IncomingRequest[]>("/api/contact-requests/incoming", {
      baseUrl: "",
      credentials: "same-origin",
    }),
  listOutgoing: () =>
    apiRequest<OutgoingRequest[]>("/api/contact-requests/outgoing", {
      baseUrl: "",
      credentials: "same-origin",
    }),
  approve: (requestId: string) =>
    apiRequest<ApproveRequestResult>(
      `/api/contact-requests/${requestId}/approve`,
      {
        method: "POST",
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
  reject: (requestId: string) =>
    apiRequest<RejectRequestResult>(
      `/api/contact-requests/${requestId}/reject`,
      {
        method: "POST",
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};
