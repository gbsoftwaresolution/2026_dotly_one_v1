"use client";

import type { PropsWithChildren, ReactNode } from "react";

import { usePathname } from "next/navigation";

import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { ShareFloatingButton } from "@/components/share/share-floating-button";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import {
  getAppSectionDescription,
  getAppSectionLabel,
} from "@/lib/constants/navigation";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { SessionSnapshot } from "@/types/auth";
import { AppPrefetchBootstrap } from "./app-prefetch-bootstrap";
import { SessionStatus } from "./session-status";

interface AppShellProps extends PropsWithChildren {
  headerAction?: ReactNode;
  session: SessionSnapshot;
}

export function AppShell({ children, headerAction, session }: AppShellProps) {
  const pathname = usePathname();
  const sectionLabel = getAppSectionLabel(pathname);
  const sectionDescription = getAppSectionDescription(pathname);
  const isShareRoute = pathname === routes.app.qr;

  return (
    <AuthSessionProvider session={session}>
      <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col bg-transparent">
        <AppPrefetchBootstrap />

        {isShareRoute ? <div className="safe-pt" /> : null}

        {!isShareRoute ? (
          <div className="sticky top-0 z-[100] px-4 pt-4 md:pt-6 pb-2 pointer-events-none w-full max-w-[800px] mx-auto flex justify-center">
            <header
              className={[
                "pointer-events-auto flex w-full items-center justify-between px-3 h-[60px] rounded-[1.5rem] premium-card transition-all",
                "shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
              ].join(" ")}
            >
              <div className="flex flex-col justify-center min-w-0 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold tracking-wide text-foreground">
                    Dotly
                  </span>
                  <span className="text-[13px] font-semibold text-muted tracking-wide truncate">
                    / {sectionLabel}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 pr-1">
                <div className="hidden sm:block min-w-0 pr-3 border-r border-border-subtle">
                  <SessionStatus />
                </div>
                <div className="flex items-center gap-2">
                  <NotificationBadge />
                  {headerAction ?? null}
                </div>
              </div>
            </header>
          </div>
        ) : null}

        <main
          className={cn(
            "safe-pl safe-pr flex-1",
            isShareRoute ? "px-0 py-0" : "px-5 py-5 pb-nav",
          )}
        >
          <div className={cn(isShareRoute ? "min-h-screen-dvh" : "space-y-4")}>
            {!isShareRoute ? <EmailVerificationBanner /> : null}
            {children}
          </div>
        </main>

        {!isShareRoute ? <ShareFloatingButton /> : null}
        {!isShareRoute ? <BottomNav /> : null}
      </div>
    </AuthSessionProvider>
  );
}
