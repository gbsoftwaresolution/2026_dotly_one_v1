import { apiRequest } from "./client";
import type {
  MarkAllReadResult,
  Notification,
  NotificationListResult,
} from "@/types/notification";

const BFF = { baseUrl: "", credentials: "same-origin" as const };

export const notificationApi = {
  /** List notifications for the current user (newest first) */
  list: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined)
      query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiRequest<NotificationListResult>(
      `/api/notifications${qs ? `?${qs}` : ""}`,
      BFF,
    );
  },

  /** Get unread count */
  getUnreadCount: () =>
    apiRequest<{ unreadCount: number }>(`/api/notifications/count-unread`, BFF),

  /** Mark a single notification as read */
  markAsRead: (id: string) =>
    apiRequest<Notification>(`/api/notifications/${id}/read`, {
      ...BFF,
      method: "POST",
    }),

  /** Mark all notifications as read */
  markAllAsRead: () =>
    apiRequest<MarkAllReadResult>(`/api/notifications/read-all`, {
      ...BFF,
      method: "POST",
    }),
};
