import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { BeginPasskeyAuthenticationResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
    };

    const result = await apiRequest<BeginPasskeyAuthenticationResult>(
      "/auth/passkeys/authenticate/options",
      {
        method: "POST",
        body,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to start passkey sign-in right now.",
    );
  }
}
