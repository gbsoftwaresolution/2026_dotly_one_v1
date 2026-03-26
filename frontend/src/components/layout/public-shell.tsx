"use client";

import type { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { FloatingAppBar } from "@/components/layout/floating-app-bar";
import { PublicFooter } from "@/components/layout/public-footer";

export function PublicShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const topLevelPath = pathname.split("/").filter(Boolean);
  const isCanonicalPublicProfileRoute =
    topLevelPath.length === 1 &&
    topLevelPath[0] !== "login" &&
    topLevelPath[0] !== "signup" &&
    topLevelPath[0] !== "support" &&
    topLevelPath[0] !== "terms" &&
    topLevelPath[0] !== "privacy" &&
    topLevelPath[0] !== "verify-email" &&
    topLevelPath[0] !== "forgot-password" &&
    topLevelPath[0] !== "reset-password";

  // App routes that don't get the marketing App Bar
  const isAppRoute =
    pathname.startsWith("/u/") ||
    pathname.startsWith("/q/") ||
    isCanonicalPublicProfileRoute;

  // The marketing/auth routes should just have the floating app bar
  if (!isAppRoute) {
    return (
      <div className="min-h-screen-dvh flex flex-col relative w-full overflow-x-hidden">
        <FloatingAppBar />
        {children}
        <div className="mt-auto">
          <PublicFooter />
        </div>
      </div>
    );
  }

  // Standalone mode for profiles and other naked routes
  return <div className="min-h-screen-dvh">{children}</div>;
}
