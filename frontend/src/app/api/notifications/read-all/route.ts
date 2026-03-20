import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { MarkAllReadResult } from "@/types/notification";

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

/** POST /api/notifications/read-all — mark all notifications as read */
export async function POST() {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  try {
    const result = await apiRequest<MarkAllReadResult>(
      `/notifications/read-all`,
      { token: tokenOrResponse, method: "POST" },
    );
    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to mark all notifications as read.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
