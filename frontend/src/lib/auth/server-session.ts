import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "./constants";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const COOKIE_SAME_SITE_VALUES = new Set(["strict", "lax", "none"]);

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error("AUTH_COOKIE_SECURE must be either true or false when set.");
}

function isLocalOrPlaceholderHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\./, "");

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".internal")
  );
}

function getCookieSameSite(): "strict" | "lax" | "none" {
  const configuredValue = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();

  if (!configuredValue) {
    return "lax";
  }

  if (!COOKIE_SAME_SITE_VALUES.has(configuredValue)) {
    throw new Error(
      "AUTH_COOKIE_SAME_SITE must be one of strict, lax, or none when set.",
    );
  }

  return configuredValue as "strict" | "lax" | "none";
}

function getCookieDomain(): string | undefined {
  const configuredValue = process.env.AUTH_COOKIE_DOMAIN?.trim();

  if (!configuredValue) {
    return undefined;
  }

  if (/[:/]/.test(configuredValue)) {
    throw new Error(
      "AUTH_COOKIE_DOMAIN must be a bare hostname or registrable domain without a protocol or path.",
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    isLocalOrPlaceholderHost(configuredValue)
  ) {
    throw new Error(
      "AUTH_COOKIE_DOMAIN must not target localhost or placeholder domains in production.",
    );
  }

  return configuredValue;
}

export function resolveAuthCookieOptions() {
  const sameSite = getCookieSameSite();
  const secureOverride = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE);
  const secure = secureOverride ?? process.env.NODE_ENV === "production";
  const domain = getCookieDomain();

  if (process.env.NODE_ENV === "production" && !secure) {
    throw new Error("AUTH_COOKIE_SECURE cannot be false in production.");
  }

  if (sameSite === "none" && !secure) {
    throw new Error(
      "AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.",
    );
  }

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    domain,
    priority: "high" as const,
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
    ...resolveAuthCookieOptions(),
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    ...resolveAuthCookieOptions(),
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    expires: new Date(0),
  });
}
