import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { VerifyEmailResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string };
    const result = await apiRequest<VerifyEmailResult>("/auth/verify-email", {
      method: "POST",
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to verify your email right now.",
    );
  }
}