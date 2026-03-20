import { apiRequest } from "./client";

export const blocksApi = {
  block: (userId: string) =>
    apiRequest<{ blocked: boolean }>(`/api/blocks/${userId}`, {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),

  unblock: (userId: string) =>
    apiRequest<void>(`/api/blocks/${userId}`, {
      method: "DELETE",
      baseUrl: "",
      credentials: "same-origin",
    }),

  blockByPersona: (personaId: string) =>
    apiRequest<{ blocked: boolean }>(`/api/blocks/by-persona/${personaId}`, {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),

  list: () =>
    apiRequest<{ blockedUserId: string }[]>("/api/blocks", {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
