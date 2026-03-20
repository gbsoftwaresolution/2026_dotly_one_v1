import { type NextRequest, NextResponse } from "next/server";

import { ApiError, apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { UpdateContactNoteResult } from "@/types/contact";

export async function PATCH(
  request: NextRequest,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const result = await apiRequest<UpdateContactNoteResult>(
      `/contacts/${relationshipId}/note`,
      {
        method: "PATCH",
        body,
        token: accessToken,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return NextResponse.json(
        { message: "Contact not found" },
        { status: 404 },
      );
    }

    const response = createRouteErrorResponse(
      error,
      "Unable to save the note right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
