import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { IdentityTeamAccessPayload } from "@/types/identity";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ identityId: string }> },
) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  const { identityId } = await params;

  try {
    const teamAccess = await apiRequest<IdentityTeamAccessPayload>(
      `/identities/${identityId}/team-access`,
      {
        token: accessTokenOrResponse,
      },
    );

    return NextResponse.json(teamAccess);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load team access right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}