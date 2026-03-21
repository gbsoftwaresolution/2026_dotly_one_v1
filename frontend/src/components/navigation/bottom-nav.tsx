"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

// SVG icons for each nav item — crisp, minimal, 24×24
const NavIcons = {
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
  qr: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
      />
      <path
        d="M14 14h2v2h-2zM18 14h3v2M17 18v3M14 18h2"
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
  contacts: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  events: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
      />
      <path
        d="M8 2v4M16 2v4M3 10h18"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
      />
    </svg>
  ),
  alerts: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  analytics: (active: boolean) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[22px] w-[22px]"
      aria-hidden
    >
      <path
        d="M3 20h18M8 20V10M12 20V4M16 20v-8M20 20v-6"
        stroke="currentColor"
        strokeWidth={active ? "2" : "1.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;

type NavIconKey = keyof typeof NavIcons;

const navItems: Array<{ href: string; label: string; icon: NavIconKey }> = [
  { href: "/app/personas", label: "Personas", icon: "personas" },
  { href: "/app/qr", label: "QR", icon: "qr" },
  { href: "/app/requests", label: "Requests", icon: "requests" },
  { href: "/app/contacts", label: "Contacts", icon: "contacts" },
  { href: "/app/events", label: "Events", icon: "events" },
  { href: "/app/notifications", label: "Alerts", icon: "alerts" },
  { href: "/app/analytics", label: "Analytics", icon: "analytics" },
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
