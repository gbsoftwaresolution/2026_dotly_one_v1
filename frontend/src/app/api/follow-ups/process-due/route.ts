import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";

export async function POST() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const result = await apiRequest<{ processedCount: number }>(
      "/follow-ups/process-due",
      {
        method: "POST",
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to process due follow-ups right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}