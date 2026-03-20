import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasSession } from "@/lib/auth/middleware-session";

export function middleware(request: NextRequest) {
  if (!hasSession(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
