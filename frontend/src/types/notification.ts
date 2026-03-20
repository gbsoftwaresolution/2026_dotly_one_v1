export type NotificationType =
  | "request_received"
  | "request_approved"
  | "instant_connect"
  | "event_joined"
  | "event_request"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface MarkAllReadResult {
  updatedCount: number;
}
