import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type {
  SendContactRequestInput,
  SendContactRequestResult,
} from "@/types/request";

async function requireAccessToken() {
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

  return accessToken;
}

export async function POST(request: Request) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  try {
    const input = (await request.json()) as SendContactRequestInput;
    const result = await apiRequest<SendContactRequestResult>(
      "/contact-requests",
      {
        method: "POST",
        body: input,
        token: accessTokenOrResponse,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to send the request right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
