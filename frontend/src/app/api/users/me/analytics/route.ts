import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { CurrentUserAnalytics } from "@/types/analytics";

export async function GET() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      {
        message: "Authentication is required.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const analytics = await apiRequest<CurrentUserAnalytics>("/me/analytics", {
      token: accessToken,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load your connection progress right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
