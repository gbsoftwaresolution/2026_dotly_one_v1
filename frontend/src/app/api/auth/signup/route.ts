import { NextResponse } from "next/server";

import { ApiError, apiRequest } from "@/lib/api/client";
import { getFriendlyAuthErrorMessage } from "@/lib/auth/auth-error-messages";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import type { AuthCredentials, SignupResult } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const credentials = (await request.json()) as AuthCredentials;
    const result = await apiRequest<SignupResult>("/auth/signup", {
      method: "POST",
      body: credentials,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          message: getFriendlyAuthErrorMessage("signup", {
            status: error.status,
            message: error.message,
          }),
        },
        {
          status: error.status,
        },
      );
    }

    return createRouteErrorResponse(
      error,
      "Unable to create your account right now.",
    );
  }
}
