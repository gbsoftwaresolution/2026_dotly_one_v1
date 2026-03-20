export type EventStatus = "upcoming" | "live" | "ended";

export type EventParticipantRole = "attendee" | "speaker" | "organizer";

export interface EventSummary {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  createdAt: string;
  /** Present when the caller has joined the event */
  myParticipation?: EventParticipationSummary | null;
}

export interface EventParticipationSummary {
  personaId: string;
  role: EventParticipantRole;
  discoverable: boolean;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  personaId: string;
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  profilePhotoUrl?: string | null;
  role: EventParticipantRole;
  joinedAt: string;
}

export interface JoinEventInput {
  personaId: string;
  role?: EventParticipantRole;
}

export interface CreateEventInput {
  name: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  discoveryWindowMinutes?: number;
}
