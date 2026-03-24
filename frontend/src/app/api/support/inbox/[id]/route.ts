import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { createRouteErrorResponse } from "@/lib/api/route-error";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { SupportInboxItem } from "@/types/support";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accessToken = await getServerAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status: "open" | "resolved" };
    const result = await apiRequest<SupportInboxItem>(`/support/inbox/${id}`, {
      method: "PATCH",
      body,
      token: accessToken,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createRouteErrorResponse(
      error,
      "Unable to update the support request right now.",
    );
  }
}
