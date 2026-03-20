import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { UpdateRelationshipStateResult } from "@/types/contact";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ relationshipId: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  const { relationshipId } = await params;

  try {
    const result = await apiRequest<UpdateRelationshipStateResult>(
      `/contacts/${relationshipId}/expire`,
      {
        method: "POST",
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to expire this relationship right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
