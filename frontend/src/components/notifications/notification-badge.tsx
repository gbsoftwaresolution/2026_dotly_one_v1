"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { notificationApi } from "@/lib/api/notification-api";
import { routes } from "@/lib/constants/routes";
import {
  publishUnreadCount,
  subscribeToUnreadCount,
} from "@/lib/notifications/unread-count";

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

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
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-6 w-6 text-foreground dark:text-zinc-400"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      {unreadCount > 0 && (
        <span
          key={unreadCount} // Force re-render animation when count changes
          className="absolute right-1 top-1 flex h-4 min-w-4 animate-in zoom-in items-center justify-center rounded-full bg-brandRose px-1 text-[10px] font-bold text-white dark:bg-brandCyan dark:text-bgOnyx"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
