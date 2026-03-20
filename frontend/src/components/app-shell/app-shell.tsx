import type { PropsWithChildren, ReactNode } from "react";

import { BottomNav } from "@/components/navigation/bottom-nav";
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
    <div className="mx-auto flex min-h-screen max-w-app flex-col bg-transparent">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur dark:border-zinc-900 dark:bg-bgOnyx/95">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted dark:text-zinc-500">
                Dotly
              </p>
              <ThemeSwitcher />
            </div>
            <h1 className="text-xl font-semibold text-foreground dark:text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
            <SessionStatus />
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      </header>
      <main className="flex-1 px-4 py-5">
        <div className="space-y-4">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
