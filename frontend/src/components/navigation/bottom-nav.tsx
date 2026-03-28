"use client";

import { useEffect } from "react";

import {
  Clock3,
  LayoutGrid,
  MessageSquareMore,
  QrCode,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useActivationNudgeContext } from "@/context/ActivationNudgeContext";
import { appNavItems, type AppNavIconKey } from "@/lib/constants/navigation";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { UserActivationNudgeQueue } from "@/types/user";

const navIcons: Record<AppNavIconKey, typeof QrCode> = {
  home: LayoutGrid,
  inbox: MessageSquareMore,
  qr: QrCode,
  requests: MessageSquareMore,
  contacts: Users,
  followUps: Clock3,
  settings: Settings2,
};

function getQueueForItemHref(href: string): UserActivationNudgeQueue | null {
  if (href === routes.app.inbox) {
    return "inbox";
  }

  if (href === routes.app.requests) {
    return "requests";
  }

  return null;
}

function getOpenedQueue(pathname: string): UserActivationNudgeQueue | null {
  if (
    pathname === routes.app.requests ||
    pathname.startsWith(`${routes.app.requests}/`)
  ) {
    return "requests";
  }

  if (
    pathname === routes.app.inbox ||
    pathname.startsWith(`${routes.app.inbox}/`)
  ) {
    return "inbox";
  }

  return null;
}

export function BottomNav() {
  const pathname = usePathname();
  const { firstResponseNudge, clearQueueNudge } = useActivationNudgeContext();

  useEffect(() => {
    const openedQueue = getOpenedQueue(pathname);

    if (!openedQueue || firstResponseNudge?.queue !== openedQueue) {
      return;
    }

    void clearQueueNudge(openedQueue).catch(() => {});
  }, [clearQueueNudge, firstResponseNudge?.queue, pathname]);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-nav",
        "bg-white/60 dark:bg-zinc-950/60 backdrop-blur-3xl",
        "border-t border-black/5 dark:border-white/10 transition-all duration-300",
        "shadow-[0_-8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.2)] safe-pb",
      )}
    >
      <div className="safe-pl safe-pr mx-auto max-w-app">
        <ul className="grid grid-cols-5 gap-1 px-2 py-1.5 pb-2">
          {appNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = navIcons[item.icon];
            const itemQueue = getQueueForItemHref(item.href);
            const showNudge =
              itemQueue !== null &&
              firstResponseNudge?.queue === itemQueue &&
              !isActive;

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-2",
                    "transition-all duration-300 ease-[0.16,1,0.3,1] active:scale-[0.92] tap-feedback",
                    "no-select",
                    isActive
                      ? "bg-black/5 text-foreground dark:bg-white/10 dark:text-white"
                      : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  data-active={isActive ? "true" : "false"}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute top-1.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-foreground/80 dark:bg-white/90"
                    />
                  ) : null}

                  <span className="relative flex h-7 w-7 items-center justify-center mt-1">
                    <Icon
                      className={cn(
                        "h-[22px] w-[22px]",
                        isActive ? "opacity-100" : "opacity-80",
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden
                    />

                    {showNudge ? (
                      <>
                        <span
                          aria-hidden
                          className="absolute -right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_0_3px_rgba(255,255,255,0.92)] dark:shadow-[0_0_0_3px_rgba(10,10,10,0.92)]"
                        />
                        <span className="sr-only">
                          New activity in {item.label}
                        </span>
                      </>
                    ) : null}
                  </span>

                  <span
                    className={cn(
                      "text-[10px] font-semibold leading-none tracking-wide",
                      isActive ? "opacity-100" : "opacity-80",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
