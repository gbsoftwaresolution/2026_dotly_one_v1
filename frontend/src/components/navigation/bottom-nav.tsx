"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

// SVG icons for each nav item — crisp, minimal, 24×24
const NavIcons = {
  home: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  personas: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
      />
      <path
        d="M4.5 20c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
      />
    </svg>
  ),
  requests: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.94L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  settings: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M10.325 4.317a1 1 0 011.35-.936l.8.345a1 1 0 00.91 0l.8-.345a1 1 0 011.35.936l.073.868a1 1 0 00.552.81l.753.42a1 1 0 01.286 1.49l-.527.694a1 1 0 000 .91l.527.694a1 1 0 01-.286 1.49l-.753.42a1 1 0 00-.552.81l-.073.868a1 1 0 01-1.35.936l-.8-.345a1 1 0 00-.91 0l-.8.345a1 1 0 01-1.35-.936l-.073-.868a1 1 0 00-.552-.81l-.753-.42a1 1 0 01-.286-1.49l.527-.694a1 1 0 000-.91l-.527-.694a1 1 0 01.286-1.49l.753-.42a1 1 0 00.552-.81l.073-.868z"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
      />
    </svg>
  ),
} as const;

type NavIconKey = keyof typeof NavIcons;

const navItems: Array<{ href: string; label: string; icon: NavIconKey }> = [
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/personas", label: "Personas", icon: "personas" },
  { href: "/app/requests", label: "Requests", icon: "requests" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        // Sticky at bottom
        "fixed bottom-0 inset-x-0 z-nav",
        // Glass background — Apple Nav Bar feel
        "dark:bg-bgOnyx/80 bg-white/80",
        "backdrop-blur-2xl",
        // Top separator
        "border-t dark:border-white/[0.06] border-black/[0.06]",
        // Nav shadow upward
        "shadow-nav",
        // Safe area
        "pb-safe",
      )}
    >
      <div className="mx-auto max-w-app">
        <ul className="flex items-stretch px-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 py-2.5 px-1",
                    "min-h-[52px] w-full",
                    "transition-all duration-200 ease-spring",
                    "active:scale-[0.90]",
                    "no-select",
                    isActive
                      ? "dark:text-brandCyan text-accent"
                      : "dark:text-zinc-500 text-slate-400 hover:dark:text-zinc-300 hover:text-slate-600",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full dark:bg-brandCyan bg-accent"
                    />
                  )}

                  {/* Icon */}
                  <span className="relative">
                    {NavIcons[item.icon](isActive)}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      "font-sans text-[9px] font-semibold leading-none tracking-wide",
                      isActive ? "opacity-100" : "opacity-70",
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
