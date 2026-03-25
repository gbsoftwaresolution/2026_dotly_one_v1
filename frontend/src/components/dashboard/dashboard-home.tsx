"use client";

import Link from "next/link";
import {
  QrCode,
  Users,
  Clock3,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  WifiOff,
} from "lucide-react";

import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { UserProfile } from "@/types/user";
import type { CurrentUserAnalytics } from "@/types/analytics";
import { useNetworkStatus } from "@/lib/network/use-network-status";

interface DashboardHomeProps {
  user: UserProfile;
  initialAnalytics: CurrentUserAnalytics | null;
}

export function DashboardHome({ user, initialAnalytics }: DashboardHomeProps) {
  const isOnline = useNetworkStatus();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      {!isOnline && (
        <div className="mx-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <WifiOff className="h-4 w-4" />
          <span>You are offline. Showing cached snapshot.</span>
        </div>
      )}

      {/* Premium Hero Greeting */}
      <section className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8 bg-gradient-to-br from-foreground/5 to-transparent dark:from-white/10 dark:to-transparent ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 opacity-50 blur-3xl -z-10" />

        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {greeting}.
            </h1>
            <p className="text-muted text-sm sm:text-base mt-1">
              Welcome to your connection control panel.
            </p>
          </div>

          <Link
            href={routes.app.qr}
            className="group relative inline-flex items-center justify-between w-full overflow-hidden rounded-2xl bg-foreground text-background dark:bg-white dark:text-black px-5 py-4 mt-2 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/10 dark:shadow-white/10"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/10 dark:bg-black/10">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">Show your QR</p>
                <p className="text-xs opacity-80 font-medium">
                  Share your active persona instantly
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </section>

      {/* Analytics Snapshot */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted ml-2">
          At a Glance
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Link
            href={routes.app.contacts}
            className="flex flex-col justify-between rounded-3xl bg-white/50 dark:bg-bgOnyx/50 backdrop-blur-xl p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-2 text-muted mb-4">
              <Users className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Connections
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {initialAnalytics?.totalConnections ?? 0}
              </p>
              <div className="flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>
                  +{initialAnalytics?.connectionsThisMonth ?? 0} this month
                </span>
              </div>
            </div>
          </Link>

          <Link
            href={routes.app.followUps}
            className="flex flex-col justify-between rounded-3xl bg-white/50 dark:bg-bgOnyx/50 backdrop-blur-xl p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-2 text-muted mb-4">
              <Clock3 className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Follow-ups
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                Active
              </p>
              <div className="flex items-center gap-1 mt-1 text-muted text-xs font-medium">
                <span>Manage timeline</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Quick Actions List (Apple-style grouped list) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted ml-2">
          Quick Actions
        </h2>

        <div className="overflow-hidden rounded-[2rem] bg-white/60 dark:bg-bgOnyx/60 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            <li>
              <Link
                href={routes.app.personas}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.04] dark:active:bg-white/[0.04]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    Manage Dotlys
                  </p>
                  <p className="text-sm text-muted truncate">
                    Update your shared profiles
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted shrink-0 opacity-50" />
              </Link>
            </li>

            <li>
              <Link
                href={routes.app.requests}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.04] dark:active:bg-white/[0.04]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    Review Requests
                  </p>
                  <p className="text-sm text-muted truncate">
                    Accept or clear new connections
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted shrink-0 opacity-50" />
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
