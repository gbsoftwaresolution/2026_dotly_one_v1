import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routes } from "@/lib/constants/routes";
import { applyFrontendSecurityHeaders } from "@/lib/security/headers";

const APP_OLD_PREFIX = "/app-old";

export function getAppOldRedirectPath(pathname: string): string | null {
  if (pathname === APP_OLD_PREFIX) {
    return routes.app.home;
  }

  if (!pathname.startsWith(`${APP_OLD_PREFIX}/`)) {
    return null;
  }

  return `${routes.app.home}/${pathname.slice(APP_OLD_PREFIX.length + 1)}`;
}

export function middleware(request: NextRequest) {
  const redirectPath = getAppOldRedirectPath(request.nextUrl.pathname);

  if (!redirectPath) {
    return applyFrontendSecurityHeaders(NextResponse.next());
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = redirectPath;

  return applyFrontendSecurityHeaders(NextResponse.redirect(redirectUrl, 308));
}

export const config = {
  matcher: ["/app-old", "/app-old/:path*"],
};