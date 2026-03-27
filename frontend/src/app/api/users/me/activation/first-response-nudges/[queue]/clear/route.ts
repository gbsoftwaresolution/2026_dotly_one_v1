import { NextResponse } from "next/server";

import { createUnauthorizedRouteResponse } from "@/lib/api/auth-route-response";
import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { UserActivationNudgeQueue } from "@/types/user";

export async function POST(
  request: Request,
  context: { params: Promise<{ queue: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return createUnauthorizedRouteResponse();
  }

  const { queue } = await context.params;

  try {
    const result = await apiRequest<{
      cleared: boolean;
      queue: UserActivationNudgeQueue;
    }>(`/users/me/activation/first-response-nudges/${queue}/clear`, {
      method: "POST",
      token: accessToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to clear the queue nudge right now.",
    );
  }
}