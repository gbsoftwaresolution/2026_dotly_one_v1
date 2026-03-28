import { NextResponse } from "next/server";

import { createUnauthorizedRouteResponse } from "@/lib/api/auth-route-response";
import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { BeginPasskeyRegistrationResult } from "@/types/auth";

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createUnauthorizedRouteResponse();
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const result = await apiRequest<BeginPasskeyRegistrationResult>(
      "/users/me/passkeys/register/options",
      {
        method: "POST",
        body,
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to start passkey setup right now.",
    );
  }
}
