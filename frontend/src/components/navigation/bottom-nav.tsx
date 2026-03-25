"use client";

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

import { appNavItems, type AppNavIconKey } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const navIcons: Record<AppNavIconKey, typeof QrCode> = {
  home: LayoutGrid,
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
        "dark:bg-bgOnyx/85 bg-white/85",
        "border-t border-black/[0.06] backdrop-blur-2xl dark:border-white/[0.06]",
        "shadow-[0_-8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.2)] safe-pb",
      )}
    >
      <div className="safe-pl safe-pr mx-auto max-w-app">
        <ul className="grid grid-cols-5 gap-1 px-2 py-1.5 pb-2">
          {appNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = navIcons[item.icon];

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
                    "transition-all duration-300 ease-[0.16,1,0.3,1] active:scale-[0.92] tap-feedback",
                    "no-select",
                    isActive
                      ? "bg-foreground/[0.06] text-foreground dark:bg-white/[0.08] dark:text-white"
                      : "text-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute top-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-foreground dark:bg-white"
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
