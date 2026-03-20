import { NextResponse } from "next/server";

import { userApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { SessionSnapshot } from "@/types/auth";

function createLoggedOutResponse() {
  return NextResponse.json<SessionSnapshot>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  });
}

export async function GET() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createLoggedOutResponse();
  }

  try {
    const user = await userApi.me(accessToken);

    return NextResponse.json<SessionSnapshot>({
      isAuthenticated: true,
      isLoading: false,
      user,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const response = createLoggedOutResponse();
      clearAuthCookie(response);
      return response;
    }

    return NextResponse.json(
      {
        message: "Unable to verify the current session.",
      },
      {
        status: 503,
      },
    );
  }
}
