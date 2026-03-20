import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { PublicProfileRequestTarget } from "@/types/persona";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { username } = await params;

  try {
    const target = await apiRequest<PublicProfileRequestTarget>(
      `/public/${encodeURIComponent(username)}/request-target`,
      {
        token: accessToken,
      },
    );

    return NextResponse.json(target);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load this profile right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
