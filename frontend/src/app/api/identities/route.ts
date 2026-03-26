import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { Identity } from "@/types/identity";

export async function GET() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const identities = await apiRequest<Identity[]>("/identities", {
      token: accessToken,
    });

    return NextResponse.json(identities);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load identities right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
