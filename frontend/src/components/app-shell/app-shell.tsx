"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { usePathname } from "next/navigation";

import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { getAppSectionLabel } from "@/lib/constants/navigation";
import { SessionStatus } from "./session-status";

interface AppShellProps extends PropsWithChildren {
  headerAction?: ReactNode;
}

export function AppShell({ children, headerAction }: AppShellProps) {
  const pathname = usePathname();
  const sectionLabel = getAppSectionLabel(pathname);

  return (
    <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col bg-transparent">
      <header
        className={[
          "sticky top-0 z-header",
          "dark:bg-bgOnyx/75 bg-white/75 backdrop-blur-2xl",
          "border-b dark:border-white/[0.06] border-black/[0.06]",
        ].join(" ")}
      >
        <div className="safe-pt" />

        <div className="safe-pl safe-pr flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <span className="rounded-full bg-foreground/6 px-2.5 py-1 text-foreground/80 dark:bg-white/6 dark:text-white/80">
                Dotly
              </span>
              <span>{sectionLabel}</span>
            </div>
            <p className="text-sm leading-5 text-muted">
              Manage how you share, connect, and follow up.
            </p>
            <SessionStatus />
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1">
            <NotificationBadge />
            {headerAction ?? null}
          </div>
        </div>
      </header>

      <main className="safe-pl safe-pr flex-1 px-5 py-5 pb-nav">
        <div className="space-y-4 animate-fade-up">
          <EmailVerificationBanner />
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
