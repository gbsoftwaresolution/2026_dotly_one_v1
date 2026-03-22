import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { InstantConnectResult } from "@/types/persona";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const startedAt = performance.now();
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    const response = NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );

    response.headers.set(
      "server-timing",
      `public-instant-connect;dur=${(performance.now() - startedAt).toFixed(2)}`,
    );

    return response;
  }

  const { username } = await params;

  try {
    const result = await apiRequest<InstantConnectResult>(
      `/relationships/instant-connect/by-username/${encodeURIComponent(username)}`,
      {
        method: "POST",
        body: {
          source: "profile",
        },
        token: accessToken,
      },
    );

    const response = NextResponse.json(result, { status: 201 });

    response.headers.set(
      "server-timing",
      `public-instant-connect;dur=${(performance.now() - startedAt).toFixed(2)}`,
    );

    return response;
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to connect right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    response.headers.set(
      "server-timing",
      `public-instant-connect;dur=${(performance.now() - startedAt).toFixed(2)}`,
    );

    return response;
  }
}