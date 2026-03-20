import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { PersonaAnalytics } from "@/types/analytics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { personaId } = await params;

  try {
    const analytics = await apiRequest<PersonaAnalytics>(
      `/analytics/persona/${personaId}`,
      { token: accessToken },
    );

    return NextResponse.json(analytics);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load persona analytics right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
