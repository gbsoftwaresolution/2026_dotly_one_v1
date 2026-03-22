import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { PersonaSummary, UpdatePersonaSharingInput } from "@/types/persona";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  const { personaId } = await params;

  try {
    const input = (await request.json()) as UpdatePersonaSharingInput;
    const persona = await apiRequest<PersonaSummary>(
      `/personas/${personaId}/sharing`,
      {
        method: "PATCH",
        body: input,
        token: accessTokenOrResponse,
      },
    );

    return NextResponse.json(persona);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to update sharing settings right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}