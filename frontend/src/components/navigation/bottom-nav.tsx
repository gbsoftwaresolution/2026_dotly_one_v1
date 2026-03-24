"use client";

import {
  Clock3,
  MessageSquareMore,
  QrCode,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavItems, type AppNavIconKey } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const navIcons: Record<AppNavIconKey, typeof QrCode> = {
  qr: QrCode,
  requests: MessageSquareMore,
  contacts: Users,
  followUps: Clock3,
  settings: Settings2,
};

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-nav",
        "dark:bg-bgOnyx/80 bg-white/80",
        "border-t border-black/[0.06] backdrop-blur-2xl dark:border-white/[0.06]",
        "shadow-nav safe-pb",
      )}
    >
      <div className="safe-pl safe-pr mx-auto max-w-app">
        <ul className="grid grid-cols-5 gap-1 px-2 py-1.5">
          {appNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = navIcons[item.icon];

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex min-h-[60px] w-full flex-col items-center justify-center gap-1.5 rounded-[1.25rem] px-2 py-2.5",
                    "transition-all duration-200 ease-spring active:scale-[0.9]",
                    "no-select",
                    isActive
                      ? "bg-foreground/[0.05] text-accent dark:bg-white/[0.06] dark:text-brandCyan"
                      : "text-slate-500 hover:bg-black/[0.03] hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent dark:bg-brandCyan"
                    />
                  ) : null}

                  <span className="relative flex h-7 w-7 items-center justify-center">
                    <Icon
                      className="h-[19px] w-[19px]"
                      strokeWidth={isActive ? 2.2 : 1.9}
                      aria-hidden
                    />
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
