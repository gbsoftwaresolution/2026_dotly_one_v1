"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { notificationApi } from "@/lib/api/notification-api";
import { routes } from "@/lib/constants/routes";
import {
  publishUnreadCount,
  subscribeToUnreadCount,
} from "@/lib/notifications/unread-count";
import { readSessionCache } from "@/lib/client-session-cache";

const NOTIFICATIONS_CACHE_KEY = "dotly.notifications-screen";

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(() => {
    const cached = readSessionCache<{ unreadCount: number }>(
      NOTIFICATIONS_CACHE_KEY,
    );

    return cached?.unreadCount ?? 0;
  });

  useEffect(() => {
    let cancelled = false;

    const syncUnreadCount = async () => {
      try {
        const data = await notificationApi.getUnreadCount();

        if (!cancelled) {
          setUnreadCount(data.unreadCount);
          publishUnreadCount(data.unreadCount);
        }
      } catch {
        // Keep the last known count if polling fails.
      }
    };

    void syncUnreadCount();

    const unsubscribe = subscribeToUnreadCount((nextUnreadCount) => {
      setUnreadCount(nextUnreadCount);
    });

    const interval = setInterval(() => {
      void syncUnreadCount();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return (
    <Link
      href={routes.app.notifications}
      className="relative p-1 text-foreground/80 transition-colors hover:text-foreground no-select"
      aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
    >
      <Bell className="h-6 w-6" />
      {unreadCount > 0 ? (
        <span
          key={unreadCount}
          className="absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9px] font-black text-background ring-2 ring-background animate-scale-in dark:bg-white dark:text-zinc-950 dark:ring-bgOnyx"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
