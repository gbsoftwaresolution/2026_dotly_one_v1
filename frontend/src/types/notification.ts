import type { ContactRequestSourceType } from "./request";

export type NotificationType =
  | "request_received"
  | "request_approved"
  | "instant_connect"
  | "event_joined"
  | "event_request"
  | "system";

export interface RequestReceivedNotificationData {
  requestId?: string;
  fromPersonaId?: string;
  sourceType?: ContactRequestSourceType;
  sourceId?: string;
}

export interface RequestApprovedNotificationData {
  requestId?: string;
  toPersonaId?: string;
  relationshipId?: string;
}

export interface OwnedInstantConnectNotificationData {
  relationshipId?: string;
  targetPersonaId?: string;
}

export interface ReceivedInstantConnectNotificationData {
  sourcePersonaId?: string;
}

export type InstantConnectNotificationData =
  | OwnedInstantConnectNotificationData
  | ReceivedInstantConnectNotificationData;

export interface EventJoinedNotificationData {
  eventId?: string;
  personaId?: string;
}

export type EventRequestNotificationData = RequestReceivedNotificationData;
export type SystemNotificationData = Record<string, never>;

interface BaseNotification<T extends NotificationType, D> {
  id: string;
  type: T;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data: D;
}

export type Notification =
  | BaseNotification<"request_received", RequestReceivedNotificationData>
  | BaseNotification<"request_approved", RequestApprovedNotificationData>
  | BaseNotification<"instant_connect", InstantConnectNotificationData>
  | BaseNotification<"event_joined", EventJoinedNotificationData>
  | BaseNotification<"event_request", EventRequestNotificationData>
  | BaseNotification<"system", SystemNotificationData>;

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface MarkAllReadResult {
  updatedCount: number;
}
