import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type {
  ConnectQuickConnectQrInput,
  ConnectQuickConnectQrResult,
} from "@/types/persona";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const input = (await request.json()) as ConnectQuickConnectQrInput;
    const { code } = await context.params;
    const result = await apiRequest<ConnectQuickConnectQrResult>(
      `/qr/${encodeURIComponent(code)}/connect`,
      {
        method: "POST",
        body: input,
        token: accessToken,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to connect with this QR right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
