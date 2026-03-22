import { NextResponse } from "next/server";

const INVALID_AUTHENTICATION_TOKEN_MESSAGE = "Invalid authentication token";

export function createUnauthorizedRouteResponse() {
  return NextResponse.json(
    {
      message: INVALID_AUTHENTICATION_TOKEN_MESSAGE,
    },
    {
      status: 401,
    },
  );
}