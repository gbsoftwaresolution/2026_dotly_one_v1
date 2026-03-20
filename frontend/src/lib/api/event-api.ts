import { apiRequest } from "./client";
import type {
  EventParticipant,
  EventSummary,
  JoinEventInput,
} from "@/types/event";

const BFF = { baseUrl: "", credentials: "same-origin" as const };

export const eventApi = {
  /** List all events the current user has joined */
  list: () => apiRequest<EventSummary[]>("/api/events", BFF),

  /** Get a single event by ID */
  get: (eventId: string) =>
    apiRequest<EventSummary>(`/api/events/${eventId}`, BFF),

  /** Join an event with the given persona */
  join: (eventId: string, input: JoinEventInput) =>
    apiRequest<EventSummary>(`/api/events/${eventId}/join`, {
      ...BFF,
      method: "POST",
      body: input,
    }),

  /** Enable discovery for the current user in an event */
  enableDiscovery: (eventId: string) =>
    apiRequest<void>(`/api/events/${eventId}/discovery/enable`, {
      ...BFF,
      method: "POST",
    }),

  /** Disable discovery for the current user in an event */
  disableDiscovery: (eventId: string) =>
    apiRequest<void>(`/api/events/${eventId}/discovery/disable`, {
      ...BFF,
      method: "POST",
    }),

  /** List discoverable participants in a live event (requires joined + live window) */
  listParticipants: (eventId: string) =>
    apiRequest<EventParticipant[]>(`/api/events/${eventId}/participants`, BFF),
};
