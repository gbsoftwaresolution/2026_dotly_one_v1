import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { personaId } = await params;

  try {
    const persona = await apiRequest<{ userId: string }>(
      `/personas/${personaId}/user-identity`,
      {
        token: accessToken,
      },
    );

    await apiRequest(`/blocks/${persona.userId}`, {
      method: "POST",
      token: accessToken,
    });

    return NextResponse.json({ blocked: true }, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(error, "Unable to block user.");

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
