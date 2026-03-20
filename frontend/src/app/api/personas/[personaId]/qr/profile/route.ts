import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { QrTokenSummary } from "@/types/persona";

export async function POST(
  _request: Request,
  context: { params: Promise<{ personaId: string }> },
) {
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
    const { personaId } = await context.params;
    const qr = await apiRequest<QrTokenSummary>(
      `/personas/${personaId}/qr/profile`,
      {
        method: "POST",
        token: accessToken,
      },
    );

    return NextResponse.json(qr, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to generate a profile QR right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
