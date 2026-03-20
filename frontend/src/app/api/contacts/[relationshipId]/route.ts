import { NextResponse } from "next/server";

import { ApiError, apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { ContactDetail } from "@/types/contact";

export async function GET(
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
    const contact = await apiRequest<ContactDetail>(
      `/contacts/${relationshipId}`,
      { token: accessToken },
    );

    return NextResponse.json(contact);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return NextResponse.json(
        { message: "Contact not found" },
        { status: 404 },
      );
    }

    const response = createRouteErrorResponse(
      error,
      "Unable to load this contact right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
