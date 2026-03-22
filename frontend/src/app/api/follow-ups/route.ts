import { type NextRequest, NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { CreateFollowUpInput, FollowUp } from "@/types/follow-up";

export async function GET(request: NextRequest) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const path = qs ? `/follow-ups?${qs}` : "/follow-ups";

    const followUps = await apiRequest<FollowUp[]>(path, {
      token: accessToken,
    });

    return NextResponse.json(followUps);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load follow-ups right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}

export async function POST(request: NextRequest) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  let body: CreateFollowUpInput;

  try {
    body = (await request.json()) as CreateFollowUpInput;
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const result = await apiRequest<FollowUp>("/follow-ups", {
      method: "POST",
      body,
      token: accessToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to create the follow-up right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}