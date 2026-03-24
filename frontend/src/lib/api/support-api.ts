import type {
  CreateSupportRequestInput,
  CreateSupportRequestResult,
  SupportInboxItem,
  SupportInboxResult,
} from "@/types/support";

import { apiRequest } from "./client";

export const supportApi = {
  create: (input: CreateSupportRequestInput) =>
    apiRequest<CreateSupportRequestResult>("/api/support", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
  listInbox: (status?: "open" | "resolved") =>
    apiRequest<SupportInboxResult>(
      `/api/support/inbox${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      {
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
  updateInboxStatus: (id: string, status: "open" | "resolved") =>
    apiRequest<SupportInboxItem>(`/api/support/inbox/${id}`, {
      method: "PATCH",
      body: { status },
      baseUrl: "",
      credentials: "same-origin",
    }),
};
