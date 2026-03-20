import { type NextRequest, NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import {
  clearAuthCookie,
  getServerAccessToken,
} from "@/lib/auth/server-session";
import type { Contact } from "@/types/contact";

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
    const path = qs ? `/contacts?${qs}` : "/contacts";

    const contacts = await apiRequest<Contact[]>(path, { token: accessToken });

    return NextResponse.json(contacts);
  } catch (error) {
    const response = createRouteErrorResponse(
      error,
      "Unable to load contacts right now.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}
