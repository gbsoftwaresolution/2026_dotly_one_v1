import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { setAuthCookie } from "@/lib/auth/server-session";
import type { VerifyPasskeyAuthenticationResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      response: unknown;
    };

    const result = await apiRequest<{
      accessToken: string;
      sessionId?: string;
    }>("/auth/passkeys/authenticate/verify", {
      method: "POST",
      body,
    });

    const response = NextResponse.json<VerifyPasskeyAuthenticationResult>({
      success: true,
      sessionId: result.sessionId,
    });

    setAuthCookie(response, result.accessToken);

    return response;
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to complete passkey sign-in right now.",
    );
  }
}
