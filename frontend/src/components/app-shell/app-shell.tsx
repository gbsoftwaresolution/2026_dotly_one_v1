import type { PropsWithChildren, ReactNode } from "react";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { SessionStatus } from "./session-status";
import { ThemeSwitcher } from "./theme-switcher";

interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
}

export function AppShell({
  children,
  title,
  subtitle,
  headerAction,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-screen-dvh max-w-app flex-col bg-transparent">
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className={[
          "sticky top-0 z-header",
          // Glass blur
          "dark:bg-bgOnyx/75 bg-white/75 backdrop-blur-2xl",
          // Bottom separator
          "border-b dark:border-white/[0.06] border-black/[0.06]",
        ].join(" ")}
      >
        {/* Safe-area top inset for notched devices */}
        <div className="safe-pt" />

        <div className="flex items-start justify-between gap-3 px-5 py-3.5">
          <div className="space-y-0.5 min-w-0">
            {/* Eyebrow row */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] dark:text-zinc-600 text-slate-400">
                Dotly
              </span>
              <ThemeSwitcher />
              <NotificationBadge />
            </div>

            {/* Page title */}
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground truncate">
              {title}
            </h1>

            {subtitle ? (
              <p className="text-xs text-muted leading-relaxed line-clamp-1">
                {subtitle}
              </p>
            ) : null}

            <SessionStatus />
          </div>

          {headerAction ? (
            <div className="shrink-0 flex items-center pt-1">
              {headerAction}
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Main content ───────────────────────────────── */}
      <main className="flex-1 px-5 py-5 pb-nav">
        <div className="space-y-4 animate-fade-up">{children}</div>
      </main>

      {/* ── Bottom Nav ─────────────────────────────────── */}
      <BottomNav />
    </div>
  );
}
