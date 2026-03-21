"use client";

import type { PropsWithChildren } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";

export function PublicShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const topLevelPath = pathname.split("/").filter(Boolean);
  const isCanonicalPublicProfileRoute =
    topLevelPath.length === 1 &&
    topLevelPath[0] !== "login" &&
    topLevelPath[0] !== "signup";

  const isFullscreenRoute =
    pathname.startsWith("/u/") ||
    pathname.startsWith("/q/") ||
    isCanonicalPublicProfileRoute;

  if (isFullscreenRoute) {
    return <div className="min-h-screen-dvh">{children}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col px-5 pb-10">
      {/* ── Header bar ──────────────────────────────── */}
      <header
        className={[
          "sticky top-0 z-header flex items-center justify-between py-4",
          // Glass
          "dark:bg-bgOnyx/80 bg-white/80 backdrop-blur-2xl",
          "-mx-5 px-5",
        ].join(" ")}
      >
        {/* Wordmark */}
        <Link href="/" className="group flex items-center gap-1.5 no-select">
          {/* D mark */}
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

        {/* Right controls */}
        <nav className="flex items-center gap-1" aria-label="Site navigation">
          <ThemeSwitcher />
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-pill px-4 font-sans text-sm font-semibold text-muted transition-all duration-200 hover:text-foreground hover:dark:bg-white/[0.06] hover:bg-slate-100 active:scale-95"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="relative inline-flex h-9 items-center rounded-pill px-4 font-sans text-sm font-bold overflow-hidden no-select transition-all duration-250 ease-spring active:scale-[0.96] dark:bg-brandCyan dark:text-bgOnyx bg-brandRose text-white hover:opacity-90"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
            Sign up
          </Link>
        </nav>
      </header>

      {/* ── Page content ────────────────────────────── */}
      <main className="flex flex-1 items-center py-8">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
