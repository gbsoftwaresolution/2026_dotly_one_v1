import type { AnalyticsSummary, PersonaAnalytics } from "@/types/analytics";

import { apiRequest } from "./client";

export const analyticsApi = {
  getSummary: () =>
    apiRequest<AnalyticsSummary>("/api/analytics/summary", {
      baseUrl: "",
      credentials: "same-origin",
    }),

  getPersona: (personaId: string) =>
    apiRequest<PersonaAnalytics>(`/api/analytics/persona/${personaId}`, {
      baseUrl: "",
      credentials: "same-origin",
    }),
};
