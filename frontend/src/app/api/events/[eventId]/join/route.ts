import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { EventSummary, JoinEventInput } from "@/types/event";

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

/** POST /api/events/[eventId]/join — join an event and return event summary */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { eventId } = await params;

  try {
    const input = (await request.json()) as JoinEventInput;
    const event = await apiRequest<EventSummary>(`/events/${eventId}/join`, {
      method: "POST",
      body: input,
      token: tokenOrResponse,
    });
    return NextResponse.json(event);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to join this event right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
