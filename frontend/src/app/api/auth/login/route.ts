import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { setAuthCookie } from "@/lib/auth/server-session";
import type { AuthCredentials, LoginResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const credentials = (await request.json()) as AuthCredentials;
    const result = await apiRequest<{
      accessToken: string;
      sessionId?: string;
    }>("/auth/login", {
      method: "POST",
      body: credentials,
    });

    const response = NextResponse.json<LoginResult>({
      success: true,
      sessionId: result.sessionId,
    });
    setAuthCookie(response, result.accessToken);

    return response;
  } catch (error) {
    return createRouteErrorResponse(error, "Unable to log in right now.");
  }
}
