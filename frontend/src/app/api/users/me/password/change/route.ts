import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { PasswordMutationResult } from "@/types/auth";

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };
    const result = await apiRequest<PasswordMutationResult>(
      "/users/me/password/change",
      {
        method: "POST",
        body,
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to change your password right now.",
    );
  }
}
