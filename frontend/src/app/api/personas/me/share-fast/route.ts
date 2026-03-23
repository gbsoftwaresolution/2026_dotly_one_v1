import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { MyFastSharePayload } from "@/types/persona";

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
    const sharePayload = await apiRequest<MyFastSharePayload>(
      "/personas/me/share-fast",
      {
        token: accessToken,
      },
    );

    return NextResponse.json(sharePayload);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load the share card right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}