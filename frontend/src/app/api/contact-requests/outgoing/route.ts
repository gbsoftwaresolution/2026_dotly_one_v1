import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { OutgoingRequest } from "@/types/request";

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
    const requests = await apiRequest<OutgoingRequest[]>(
      "/contact-requests/outgoing",
      {
        token: accessToken,
      },
    );

    return NextResponse.json(requests);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load outgoing requests right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
