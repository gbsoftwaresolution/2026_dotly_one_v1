import type {
  CreatePersonaInput,
  MyFastSharePayload,
  PersonaFastSharePayload,
  PersonaSummary,
  UpdatePersonaInput,
  UpdatePersonaSharingInput,
} from "@/types/persona";

import { apiRequest } from "./client";

export const personaApi = {
  list: (token?: string) =>
    apiRequest<PersonaSummary[]>(token ? "/personas" : "/api/personas", {
      token,
      baseUrl: token ? undefined : "",
      credentials: token ? undefined : "same-origin",
    }),

  get: (personaId: string, token?: string) =>
    apiRequest<PersonaSummary>(
      token ? `/personas/${personaId}` : `/api/personas/${personaId}`,
      {
        token,
        baseUrl: token ? undefined : "",
        credentials: token ? undefined : "same-origin",
      },
    ),

  getFastShare: (personaId: string, token?: string) =>
    apiRequest<PersonaFastSharePayload>(
      token
        ? `/personas/${personaId}/share-fast`
        : `/api/personas/${personaId}/share-fast`,
      {
        token,
        baseUrl: token ? undefined : "",
        credentials: token ? undefined : "same-origin",
      },
    ),

  getMyFastShare: (token?: string) =>
    apiRequest<MyFastSharePayload>(
      token ? "/personas/me/share-fast" : "/api/personas/me/share-fast",
      {
        token,
        baseUrl: token ? undefined : "",
        credentials: token ? undefined : "same-origin",
      },
    ),

  create: (input: CreatePersonaInput) =>
    apiRequest<PersonaSummary>("/api/personas", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),

  update: (personaId: string, input: UpdatePersonaInput) =>
    apiRequest<PersonaSummary>(`/api/personas/${personaId}`, {
      method: "PATCH",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),

  updateSharing: (personaId: string, input: UpdatePersonaSharingInput) =>
    apiRequest<PersonaSummary>(`/api/personas/${personaId}/sharing`, {
      method: "PATCH",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
};
