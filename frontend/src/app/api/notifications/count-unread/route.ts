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

/** GET /api/notifications/count-unread — get unread notifications count */
export async function GET() {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  try {
    const result = await apiRequest<{ unreadCount: number }>(
      `/notifications/count-unread`,
      { token: tokenOrResponse },
    );
    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load unread count.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
