import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { Notification } from "@/types/notification";

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

/** POST /api/notifications/[id]/read — mark a single notification as read */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tokenOrResponse = await requireAccessToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;

  const { id } = await params;

  try {
    const notification = await apiRequest<Notification>(
      `/notifications/${id}/read`,
      { token: tokenOrResponse, method: "POST" },
    );
    return NextResponse.json(notification);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to mark notification as read.",
    );
    if (response.status === 401) clearAuthCookie(response);
    return response;
  }
}
