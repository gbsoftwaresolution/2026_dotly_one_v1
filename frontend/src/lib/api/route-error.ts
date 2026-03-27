import { NextResponse } from "next/server";

import { ApiError } from "./client";

export function createRouteErrorResponse(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof ApiError) {
    const response = NextResponse.json(
      {
        message: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      },
      {
        status: error.status,
      },
    );

    if (error.requestId) {
      response.headers.set("x-upstream-request-id", error.requestId);
    }

    return response;
  }

  return NextResponse.json(
    {
      message: fallbackMessage,
    },
    {
      status: 500,
    },
  );
}
