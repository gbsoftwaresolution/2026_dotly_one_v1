import { NextResponse } from "next/server";

import { apiRequest } from "@/lib/api/client";
import { clearAuthCookie } from "@/lib/auth/server-session";
import { getServerAccessToken } from "@/lib/auth/server-session";

export async function POST() {
  const accessToken = await getServerAccessToken();

  if (accessToken) {
    await apiRequest<{ success: boolean }>("/auth/sessions/current", {
      method: "DELETE",
      token: accessToken,
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);

  return response;
}
