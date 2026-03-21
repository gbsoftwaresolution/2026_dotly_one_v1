import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { RevokeSessionResult } from "@/types/auth";

export async function POST() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await apiRequest<RevokeSessionResult>(
      "/users/me/sessions/revoke-others",
      {
        method: "POST",
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to sign out your other sessions right now.",
    );
  }
}
