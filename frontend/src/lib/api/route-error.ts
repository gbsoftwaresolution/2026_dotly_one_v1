import { NextResponse } from "next/server";

import { ApiError } from "./client";

export function createRouteErrorResponse(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        message: error.message,
        details: error.details,
      },
      {
        status: error.status,
      },
    );
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
