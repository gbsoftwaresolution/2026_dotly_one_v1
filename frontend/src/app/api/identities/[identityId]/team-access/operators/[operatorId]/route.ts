import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { IdentityTeamAccessEntry } from "@/types/identity";

async function requireAccessToken() {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  return accessToken;
}

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ identityId: string; operatorId: string }> },
) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  const { identityId, operatorId } = await params;

  try {
    const input = (await request.json()) as { personaIds: string[] };
    const entry = await apiRequest<IdentityTeamAccessEntry>(
      `/identities/${identityId}/operators/${operatorId}/persona-assignments`,
      {
        method: "PUT",
        body: input,
        token: accessTokenOrResponse,
      },
    );

    return NextResponse.json(entry);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to update operator assignments right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}