import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { PersonaUsernameAvailability } from "@/types/persona";

export async function GET(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username") ?? "";
    const result = await apiRequest<PersonaUsernameAvailability>(
      `/personas/availability/username?username=${encodeURIComponent(username)}`,
      {
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to check username availability right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
