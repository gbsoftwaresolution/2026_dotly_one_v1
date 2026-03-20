import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";

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

/** POST /api/events/[eventId]/discovery/disable — opt out of discovery */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { eventId } = await params;

  try {
    await apiRequest<void>(`/events/${eventId}/discovery/disable`, {
      method: "POST",
      token: tokenOrResponse,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to disable discovery right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
