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

/** GET /api/events — list events the current user has joined */
export async function GET() {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  try {
    const events = await apiRequest<EventSummary[]>("/events", {
      token: tokenOrResponse,
    });
    return NextResponse.json(events);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load events right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
