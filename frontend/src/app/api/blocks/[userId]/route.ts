import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";

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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  const { userId } = await params;

  try {
    await apiRequest(`/blocks/${userId}`, {
      method: "POST",
      token: accessTokenOrResponse,
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const accessTokenOrResponse = await requireAccessToken();

  if (accessTokenOrResponse instanceof NextResponse) {
    return accessTokenOrResponse;
  }

  const { userId } = await params;

  try {
    await apiRequest(`/blocks/${userId}`, {
      method: "DELETE",
      token: accessTokenOrResponse,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = createRouteErrorResponse(error, "Unable to unblock user.");

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
