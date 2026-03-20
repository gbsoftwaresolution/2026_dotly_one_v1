import { type NextRequest, NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { NotificationListResult } from "@/types/notification";

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

/** GET /api/notifications — list notifications for the current user */
export async function GET(request: NextRequest) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  const query = new URLSearchParams();
  if (limit) query.set("limit", limit);
  if (offset) query.set("offset", offset);
  const qs = query.toString();

  try {
    const result = await apiRequest<NotificationListResult>(
      `/notifications${qs ? `?${qs}` : ""}`,
      { token: tokenOrResponse },
    );
    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load notifications right now.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
