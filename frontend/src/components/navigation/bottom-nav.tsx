"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-t border-border bg-surface/95 px-2 py-2 backdrop-blur safe-pb dark:border-zinc-900 dark:bg-bgOnyx/95"
    >
      <ul
        className="mx-auto grid max-w-app gap-1"
        style={{
          gridTemplateColumns: `repeat(${appNavItems.length}, minmax(0, 1fr))`,
        }}
      >
        {appNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-2xl px-2 text-xs font-medium transition",
                  isActive
                    ? "bg-slate-100 text-foreground dark:bg-zinc-800 dark:text-brandCyan"
                    : "text-muted hover:bg-slate-50 hover:text-foreground dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
