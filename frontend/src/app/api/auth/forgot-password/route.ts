import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { ForgotPasswordResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string };
    const result = await apiRequest<ForgotPasswordResult>(
      "/auth/forgot-password",
      {
        method: "POST",
        body,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to start password recovery right now.",
    );
  }
}
