import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { FollowUp } from "@/types/follow-up";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const result = await apiRequest<FollowUp>(`/follow-ups/${id}/complete`, {
      method: "POST",
      token: accessToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to complete this follow-up right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}