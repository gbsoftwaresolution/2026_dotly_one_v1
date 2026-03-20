import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { CreatePersonaInput, PersonaSummary } from "@/types/persona";

async function requireAccessToken() {
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

  return accessToken;
}

export async function GET() {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  try {
    const personas = await apiRequest<PersonaSummary[]>("/personas", {
      token: accessTokenOrResponse,
    });

    return NextResponse.json(personas);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load personas right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}

export async function POST(request: Request) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  try {
    const input = (await request.json()) as CreatePersonaInput;
    const persona = await apiRequest<PersonaSummary>("/personas", {
      method: "POST",
      body: input,
      token: accessTokenOrResponse,
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to create persona right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
