import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { CurrentUserReferral } from "@/types/user";

export async function GET() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      {
        message: "Authentication is required.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const referral = await apiRequest<CurrentUserReferral>(
      "/users/me/referral",
      {
        token: accessToken,
      },
    );

    return NextResponse.json(referral);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load your referral code right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
