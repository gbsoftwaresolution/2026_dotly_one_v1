import type { CreatePersonaInput, PersonaSummary } from "@/types/persona";

import { apiRequest } from "./client";

export const personaApi = {
  list: (token: string) =>
    apiRequest<PersonaSummary[]>("/personas", {
      token,
    }),
  create: (input: CreatePersonaInput) =>
    apiRequest<PersonaSummary>("/api/personas", {
      method: "POST",
      body: input,
      baseUrl: "",
      credentials: "same-origin",
    }),
};
