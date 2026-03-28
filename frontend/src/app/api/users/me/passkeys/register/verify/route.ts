import { NextResponse } from "next/server";

import { createUnauthorizedRouteResponse } from "@/lib/api/auth-route-response";
import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { VerifyPasskeyRegistrationResult } from "@/types/auth";

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createUnauthorizedRouteResponse();
  }

  try {
    const body = (await request.json()) as {
      response: unknown;
      name?: string;
    };
    const result = await apiRequest<VerifyPasskeyRegistrationResult>(
      "/users/me/passkeys/register/verify",
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
      "Unable to finish passkey setup right now.",
    );
  }
}
