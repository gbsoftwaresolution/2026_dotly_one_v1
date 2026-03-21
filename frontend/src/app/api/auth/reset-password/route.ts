import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { PasswordMutationResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string; password: string };
    const result = await apiRequest<PasswordMutationResult>(
      "/auth/reset-password",
      {
        method: "POST",
        body,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to reset your password right now.",
    );
  }
}
