import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { ResendVerificationEmailResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string };
    const result = await apiRequest<ResendVerificationEmailResult>(
      "/auth/verify-email/resend",
      {
        method: "POST",
        body,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to resend the verification email right now.",
    );
  }
}