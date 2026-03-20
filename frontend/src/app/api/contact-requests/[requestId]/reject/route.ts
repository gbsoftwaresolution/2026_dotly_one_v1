import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { RejectRequestResult } from "@/types/request";

export async function POST(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
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
    const { requestId } = await context.params;
    const result = await apiRequest<RejectRequestResult>(
      `/contact-requests/${requestId}/reject`,
      {
        method: "POST",
        token: accessToken,
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to reject this request right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
