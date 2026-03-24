import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { SupportInboxResult } from "@/types/support";

export async function GET(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim();
    const result = await apiRequest<SupportInboxResult>(
      `/support/inbox${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      {
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to load the support inbox right now.",
    );
  }
}
