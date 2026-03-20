import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
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
    return createRouteErrorResponse(
      error,
      "Unable to create your account right now.",
    );
  }
}
