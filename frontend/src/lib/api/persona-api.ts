import type { CreatePersonaInput, PersonaSummary } from "@/types/persona";

import { apiRequest } from "./client";

export const personaApi = {
  list: (token?: string) =>
    apiRequest<PersonaSummary[]>(token ? "/personas" : "/api/personas", {
      token,
      baseUrl: token ? undefined : "",
      credentials: token ? undefined : "same-origin",
    }),
  create: (input: CreatePersonaInput) =>
    apiRequest<PersonaSummary>("/api/personas", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
};
