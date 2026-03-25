"use client";

import type { PropsWithChildren } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { dotlyPositioning } from "@/lib/constants/positioning";

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
    topLevelPath[0] !== "forgot-password" &&
    topLevelPath[0] !== "reset-password" &&
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
    <div className="flex min-h-screen-dvh flex-col selection:bg-accent selection:text-white relative">
      {/* 
        World Class Apple Header: 
        Instead of edge-to-edge, we use a "floating island" dynamic island approach 
        for desktop, which feels significantly more modern and expensive (think Apple Vision Pro UI).
      */}
      <div className="fixed top-0 inset-x-0 z-[100] flex justify-center p-4 md:p-6 pointer-events-none">
        <header className="pointer-events-auto flex items-center justify-between px-2 h-14 w-full max-w-[1000px] rounded-full premium-card shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
          {/* Left: Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2 pl-3 no-select tap-feedback rounded-full h-10 px-2 hover:bg-foreground/5 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-foreground" strokeWidth={2.5} />
            <span className="font-sans text-[15px] font-bold tracking-tight text-foreground">
              Dotly
            </span>
          </Link>

          {/* Right: Navigation */}
          <nav
            className="flex items-center gap-1 pr-1"
            aria-label="Site navigation"
          >
            {isAcquisitionRoute ? (
              <div className="hidden md:flex items-center gap-1 mr-2 border-r border-border-subtle pr-3">
                <Link
                  href="/support"
                  className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold text-muted transition-colors hover:bg-foreground/10 hover:text-foreground tap-feedback"
                >
                  Support
                </Link>
                <div className="px-1 scale-[0.85]">
                  <ThemeSwitcher />
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1 mr-2 border-r border-border-subtle pr-3">
                <Link
                  href="/support"
                  className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold text-muted transition-colors hover:bg-foreground/10 hover:text-foreground tap-feedback"
                >
                  Support
                </Link>
                <div className="px-1 scale-[0.85]">
                  <ThemeSwitcher />
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full px-5 text-[14px] font-semibold text-foreground transition-all hover:bg-foreground/10 tap-feedback active:scale-[0.96]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-full px-6 text-[14px] font-semibold bg-foreground text-background transition-all hover:scale-[0.98] tap-feedback active:scale-[0.96] shadow-sm ring-1 ring-transparent hover:ring-foreground/20"
              >
                {dotlyPositioning.cta.primary}
              </Link>
            </div>
          </nav>
        </header>
      </div>

      <main className="flex flex-1 flex-col w-full mx-auto">{children}</main>

      {/* World Class Enterprise Footer */}
      <footer className="w-full mt-auto border-t border-black/5 dark:border-white/5 bg-foreground/[0.01]">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-8 mb-12 md:mb-16">
            <div className="col-span-2 flex flex-col items-start">
              <Link
                href="/"
                className="group flex items-center gap-2 mb-5 no-select tap-feedback"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-background shadow-sm">
                  <Sparkles className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="font-sans text-[17px] font-bold tracking-tight text-foreground">
                  Dotly
                </span>
              </Link>
              <p className="text-[15px] font-medium text-muted leading-relaxed max-w-[34ch]">
                The pure identity layer. Share your context securely, everywhere
                you go. Built with absolute privacy.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground mb-1">
                Platform
              </h3>
              <Link
                href="/signup"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Sign In
              </Link>
              <Link
                href="/forgot-password"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Reset Password
              </Link>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground mb-1">
                Resources
              </h3>
              <Link
                href="/support"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Support Center
              </Link>
              <Link
                href="/privacy"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-[14px] font-medium text-muted hover:text-foreground transition-colors tap-feedback"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-8 border-t border-black/5 dark:border-white/5">
            <p className="text-[13px] font-medium text-muted">
              &copy; {new Date().getFullYear()} Dotly Inc. All rights reserved.
            </p>
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                  All systems operational
                </span>
              </div>

              <div className="md:hidden flex items-center scale-[0.9] origin-right">
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
