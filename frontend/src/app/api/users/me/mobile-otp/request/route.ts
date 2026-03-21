import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { RequestMobileOtpResult } from "@/types/auth";

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { phoneNumber: string };
    const result = await apiRequest<RequestMobileOtpResult>(
      "/users/me/mobile-otp/request",
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
      "Unable to send a verification code right now.",
    );
  }
}
