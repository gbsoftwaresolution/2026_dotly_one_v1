import type {
  CreateFollowUpInput,
  FollowUp,
  FollowUpListQuery,
  UpdateFollowUpInput,
} from "@/types/follow-up";

import { apiRequest } from "./client";

function buildListPath(query?: FollowUpListQuery) {
  const searchParams = new URLSearchParams();

  if (query?.status) {
    searchParams.set("status", query.status);
  }

  if (query?.relationshipId) {
    searchParams.set("relationshipId", query.relationshipId);
  }

  if (query?.upcoming !== undefined) {
    searchParams.set("upcoming", String(query.upcoming));
  }

  const qs = searchParams.toString();
  return qs ? `/api/follow-ups?${qs}` : "/api/follow-ups";
}

export const followUpsApi = {
  create: (payload: CreateFollowUpInput) =>
    apiRequest<FollowUp>("/api/follow-ups", {
      method: "POST",
      body: payload,
      baseUrl: "",
      credentials: "same-origin",
    }),

  list: (query?: FollowUpListQuery) =>
    apiRequest<FollowUp[]>(buildListPath(query), {
      baseUrl: "",
      credentials: "same-origin",
    }),

  processDue: () =>
    apiRequest<{ processedCount: number }>("/api/follow-ups/process-due", {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),

  get: (id: string) =>
    apiRequest<FollowUp>(`/api/follow-ups/${id}`, {
      baseUrl: "",
      credentials: "same-origin",
    }),

  update: (id: string, payload: UpdateFollowUpInput) =>
    apiRequest<FollowUp>(`/api/follow-ups/${id}`, {
      method: "PATCH",
      body: payload,
      baseUrl: "",
      credentials: "same-origin",
    }),

  complete: (id: string) =>
    apiRequest<FollowUp>(`/api/follow-ups/${id}/complete`, {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),

  cancel: (id: string) =>
    apiRequest<FollowUp>(`/api/follow-ups/${id}/cancel`, {
      method: "POST",
      baseUrl: "",
      credentials: "same-origin",
    }),
};