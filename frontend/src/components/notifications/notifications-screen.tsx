"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { notificationApi } from "@/lib/api/notification-api";
import { ApiError } from "@/lib/api/client";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import { routes } from "@/lib/constants/routes";
import { publishUnreadCount } from "@/lib/notifications/unread-count";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import type { Notification } from "@/types/notification";
import { useRouter } from "next/navigation";

import { NotificationItem } from "./notification-item";

const NOTIFICATIONS_CACHE_KEY = "dotly.notifications-screen";

type NotificationsCacheValue = {
  notifications: Notification[];
  unreadCount: number;
};

export function NotificationsScreen() {
  const router = useRouter();
  const initialCacheRef = useRef(
    readSessionCache<NotificationsCacheValue>(NOTIFICATIONS_CACHE_KEY),
  );
  const [notifications, setNotifications] = useState<Notification[]>(
    () => initialCacheRef.current?.notifications ?? [],
  );
  const [unreadCount, setUnreadCount] = useState(
    () => initialCacheRef.current?.unreadCount ?? 0,
  );
  const [isLoading, setIsLoading] = useState(
    () => initialCacheRef.current === null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [markReadError, setMarkReadError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markAllError, setMarkAllError] = useState<string | null>(null);

  useEffect(() => {
    writeSessionCache(NOTIFICATIONS_CACHE_KEY, {
      notifications,
      unreadCount,
    });
  }, [notifications, unreadCount]);

  const loadNotifications = useCallback(
    async (options?: { withLoading?: boolean; clearError?: boolean }) => {
      if (options?.withLoading ?? true) {
        setIsLoading(true);
      }

      if (options?.clearError ?? true) {
        setLoadError(null);
      }

      try {
        const data = await notificationApi.list();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        publishUnreadCount(data.unreadCount);
        return data;
      } catch (err: unknown) {
        if (isExpiredSessionError(err)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.notifications)}&reason=expired`,
          );
          return null;
        }

        if (options?.clearError ?? true) {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to load notifications.";
          setLoadError(message);
        }

        return null;
      } finally {
        if (options?.withLoading ?? true) {
          setIsLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    void loadNotifications({ withLoading: initialCacheRef.current === null });
  }, [loadNotifications]);

  function getMarkReadErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return "This notification is no longer available. Refreshing the list...";
      }

      if (error.status === 400) {
        return "This notification link is invalid. Refreshing the list...";
      }

      return error.message;
    }

    return "Could not mark this notification as read.";
  }

  async function handleMarkRead(id: string) {
    setMarkingReadId(id);
    setMarkReadError(null);
    setMarkAllError(null);

    try {
      const updated = await notificationApi.markAsRead(id);
      setNotifications((prev) => {
        const nextNotifications = prev.map((notification) =>
          notification.id === id ? updated : notification,
        );
        const nextUnreadCount = nextNotifications.filter(
          (notification) => !notification.isRead,
        ).length;

        setUnreadCount(nextUnreadCount);
        publishUnreadCount(nextUnreadCount);

        return nextNotifications;
      });
    } catch (error) {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.notifications)}&reason=expired`,
        );
        return;
      }

      setMarkReadError(getMarkReadErrorMessage(error));

      if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 404)
      ) {
        await loadNotifications({ withLoading: false, clearError: false });
      }
    } finally {
      setMarkingReadId(null);
    }
  }

  async function handleMarkAll() {
    setIsMarkingAll(true);
    setMarkReadError(null);
    setMarkAllError(null);

    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      publishUnreadCount(0);
    } catch (err: unknown) {
      if (isExpiredSessionError(err)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.notifications)}&reason=expired`,
        );
        return;
      }

      setMarkAllError(
        err instanceof Error ? err.message : "Could not mark all as read.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        title="Could not load notifications"
        description={loadError}
        action={
          <PrimaryButton
            className="w-full"
            onClick={() => void loadNotifications()}
          >
            Try again
          </PrimaryButton>
        }
      />
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications yet"
        description="You will see contact requests, event updates, and connection alerts here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Mark all as read */}
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-muted dark:text-zinc-500">
            {unreadCount} unread
          </p>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={isMarkingAll}
            className="font-mono text-xs font-medium text-brandRose transition-opacity hover:opacity-70 disabled:opacity-40 dark:text-brandCyan"
          >
            {isMarkingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      ) : null}

      {markAllError ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {markAllError}
        </p>
      ) : null}

      {markReadError ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {markReadError}
        </p>
      ) : null}

      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={handleMarkRead}
          isMarkingRead={markingReadId === notification.id}
        />
      ))}
    </div>
  );
}
