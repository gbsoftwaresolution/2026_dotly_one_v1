import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { EventSummary } from "@/types/event";

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

/** GET /api/events/[eventId] — get a single event */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { eventId } = await params;

  try {
    const event = await apiRequest<EventSummary>(`/events/${eventId}`, {
      token: tokenOrResponse,
    });
    return NextResponse.json(event);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load this event right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
