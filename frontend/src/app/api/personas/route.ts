import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { CreatePersonaInput, PersonaSummary } from "@/types/persona";

export async function POST(request: Request) {
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
    const input = (await request.json()) as CreatePersonaInput;
    const persona = await apiRequest<PersonaSummary>("/personas", {
      method: "POST",
      body: input,
      token: accessToken,
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
