"use client";

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

  if (unreadCount === 0) return null;

  return (
    <Link
      href={routes.app.notifications}
      className="relative inline-flex items-center justify-center rounded-pill px-2 py-0.5 transition-all duration-200 active:scale-90 no-select"
      aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
    >
      <span
        key={unreadCount}
        className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-foreground px-1.5 font-mono text-[9px] font-black text-background animate-scale-in dark:bg-white dark:text-zinc-950"
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    </Link>
  );
}
