"use client";

import type { PropsWithChildren } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { dotlyPositioning } from "@/lib/constants/positioning";

export function PublicShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const topLevelPath = pathname.split("/").filter(Boolean);
  const isCanonicalPublicProfileRoute =
    topLevelPath.length === 1 &&
    topLevelPath[0] !== "login" &&
    topLevelPath[0] !== "signup" &&
    topLevelPath[0] !== "terms" &&
    topLevelPath[0] !== "privacy" &&
    topLevelPath[0] !== "verify-email";

  const isFullscreenRoute =
    pathname.startsWith("/u/") ||
    pathname.startsWith("/q/") ||
    isCanonicalPublicProfileRoute;

  const isAcquisitionRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email";

  if (isFullscreenRoute) {
    return <div className="min-h-screen-dvh">{children}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col px-4 pb-8 sm:px-5 sm:pb-10">
      <header
        className={[
          "sticky top-0 z-header flex items-center justify-between gap-3 py-3 sm:py-4",
          "dark:bg-bgOnyx/80 bg-white/80 backdrop-blur-2xl",
          "-mx-4 px-4 sm:-mx-5 sm:px-5",
        ].join(" ")}
      >
        <Link href="/" className="group flex items-center gap-1.5 no-select">
          <span
            aria-hidden
            className="h-7 w-7 rounded-[8px] flex items-center justify-center bg-gradient-to-br from-brandCyan to-brandViolet shadow-glow dark:shadow-glow"
          >
            <span className="font-mono text-[11px] font-black text-white">
              D
            </span>
          </span>
          <span className="font-sans text-[17px] font-bold tracking-tight text-foreground">
            otly
          </span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Site navigation">
          {isAcquisitionRoute ? (
            <div className="hidden md:flex md:items-center md:gap-2">
              <ThemeSwitcher />
            </div>
          ) : (
            <ThemeSwitcher />
          )}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-pill px-4 font-sans text-sm font-semibold text-muted transition-all duration-200 hover:text-foreground hover:dark:bg-white/[0.06] hover:bg-slate-100 active:scale-95"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="relative inline-flex min-h-11 items-center rounded-pill px-4 font-sans text-sm font-bold overflow-hidden no-select transition-all duration-250 ease-spring active:scale-[0.96] dark:bg-brandCyan dark:text-bgOnyx bg-brandRose text-white hover:opacity-90"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
            {dotlyPositioning.cta.primary}
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-start py-6 sm:items-center sm:py-8">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
