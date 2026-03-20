import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { IncomingRequest } from "@/types/request";

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
    const requests = await apiRequest<IncomingRequest[]>(
      "/contact-requests/incoming",
      {
        token: accessToken,
      },
    );

    return NextResponse.json(requests);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load incoming requests right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
