"use client";

import type { PropsWithChildren } from "react";

import { Menu, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { IdentityProvider } from "@/context/IdentityContext";
import {
  getAppSectionDescription,
  getAppSectionLabel,
} from "@/lib/constants/navigation";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { SessionSnapshot } from "@/types/auth";
import { AppPrefetchBootstrap } from "./app-prefetch-bootstrap";

interface AppShellProps extends PropsWithChildren {
  session: SessionSnapshot;
}

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const sectionLabel = getAppSectionLabel(pathname);
  const sectionDescription = getAppSectionDescription(pathname);
  const isShareRoute = pathname === routes.app.qr;

  return (
    <AuthSessionProvider session={session}>
      <IdentityProvider>
        <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col bg-transparent">
          <AppPrefetchBootstrap />

          {isShareRoute ? <div className="safe-pt" /> : null}

          {!isShareRoute ? (
            <header
              className={[
                "sticky top-0 z-header",
                "dark:bg-bgOnyx/75 bg-white/75 backdrop-blur-2xl",
                "border-b dark:border-white/[0.06] border-black/[0.06]",
              ].join(" ")}
            >
              <div className="safe-pt" />

              <div className="flex h-14 items-center justify-between px-4 sm:px-5">
                <div className="flex w-1/3 items-center justify-start gap-2">
                  <button
                    type="button"
                    className="-ml-1 p-1 text-foreground/80 transition-colors hover:text-foreground"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                  <Link
                    href={routes.app.home}
                    className="font-bold tracking-tight text-foreground"
                  >
                    Dotly
                  </Link>
                </div>

                <div className="flex w-1/3 items-center justify-center truncate font-semibold">
                  {sectionLabel}
                </div>

                <div className="flex w-1/3 shrink-0 items-center justify-end gap-3">
                  <Link
                    href={routes.app.qr}
                    className="p-1 text-foreground/80 transition-colors hover:text-foreground"
                  >
                    <QrCode className="h-6 w-6" />
                  </Link>
                  <NotificationBadge />
                </div>
              </div>
            </header>
          ) : null}

          <main
            className={cn(
              "flex-1",
              isShareRoute
                ? "px-0 py-0"
                : "px-4 py-5 sm:px-5 pb-[calc(env(safe-area-inset-bottom,0px)+140px)]",
            )}
          >
            <div
              className={cn(isShareRoute ? "min-h-screen-dvh" : "space-y-4")}
            >
              {!isShareRoute ? <EmailVerificationBanner /> : null}
              {children}
            </div>
          </main>

          {!isShareRoute ? <BottomNav /> : null}
        </div>
      </IdentityProvider>
    </AuthSessionProvider>
  );
}
