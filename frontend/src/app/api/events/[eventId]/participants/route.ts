import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { EventParticipant } from "@/types/event";

type BackendEventParticipant = {
  id: string;
  eventId: string;
  personaId: string;
  role: EventParticipant["role"];
  joinedAt: string;
  persona: {
    fullName: string;
    jobTitle?: string | null;
    companyName?: string | null;
    profilePhotoUrl?: string | null;
  };
};

async function requireAccessToken() {
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }
  return accessToken;
}

/** GET /api/events/[eventId]/participants — list discoverable participants */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { eventId } = await params;

  try {
    const participants = await apiRequest<BackendEventParticipant[]>(
      `/events/${eventId}/participants`,
      { token: tokenOrResponse },
    );
    return NextResponse.json(
      participants.map((participant) => ({
        id: participant.id,
        eventId: participant.eventId,
        personaId: participant.personaId,
        role: participant.role,
        joinedAt: participant.joinedAt,
        fullName: participant.persona.fullName,
        jobTitle: participant.persona.jobTitle ?? null,
        companyName: participant.persona.companyName ?? null,
        profilePhotoUrl: participant.persona.profilePhotoUrl ?? null,
      })) satisfies EventParticipant[],
    );
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load participants right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
