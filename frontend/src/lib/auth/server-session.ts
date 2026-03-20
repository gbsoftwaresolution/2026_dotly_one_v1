import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "./constants";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getServerAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function setAuthCookie(
  response: NextResponse,
  accessToken: string,
): void {
  response.cookies.set({
    ...getCookieOptions(),
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    ...getCookieOptions(),
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    expires: new Date(0),
  });
}
