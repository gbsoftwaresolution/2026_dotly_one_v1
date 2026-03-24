import { Prisma } from "../../generated/prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { NotificationType } from "../../common/enums/notification-type.enum";

type EmptyNotificationData = Record<string, never>;

export interface CreateRequestReceivedNotificationData {
  sourceType: ContactRequestSourceType;
}

export interface RequestReceivedNotificationData {
  sourceType?: ContactRequestSourceType;
}

export interface CreateRequestApprovedNotificationData {
  relationshipId?: string;
}

export interface RequestApprovedNotificationData {
  relationshipId?: string;
}

export interface CreateOwnedInstantConnectNotificationData {
  relationshipId?: string;
}

export interface OwnedInstantConnectNotificationData {
  relationshipId?: string;
}

export interface CreateReceivedInstantConnectNotificationData {}

export interface ReceivedInstantConnectNotificationData {}

export type CreateInstantConnectNotificationData =
  | CreateOwnedInstantConnectNotificationData
  | CreateReceivedInstantConnectNotificationData;

export type InstantConnectNotificationData =
  | OwnedInstantConnectNotificationData
  | ReceivedInstantConnectNotificationData;

export interface CreateEventJoinedNotificationData {}

export interface EventJoinedNotificationData {}

export type CreateEventRequestNotificationData =
  CreateRequestReceivedNotificationData;

export type EventRequestNotificationData = RequestReceivedNotificationData;

export interface CreateNotificationDataByType {
  [NotificationType.RequestReceived]: CreateRequestReceivedNotificationData;
  [NotificationType.RequestApproved]: CreateRequestApprovedNotificationData;
  [NotificationType.InstantConnect]: CreateInstantConnectNotificationData;
  [NotificationType.EventJoined]: CreateEventJoinedNotificationData;
  [NotificationType.EventRequest]: CreateEventRequestNotificationData;
  [NotificationType.System]: EmptyNotificationData;
}

export interface NotificationDataByType {
  [NotificationType.RequestReceived]: RequestReceivedNotificationData;
  [NotificationType.RequestApproved]: RequestApprovedNotificationData;
  [NotificationType.InstantConnect]: InstantConnectNotificationData;
  [NotificationType.EventJoined]: EventJoinedNotificationData;
  [NotificationType.EventRequest]: EventRequestNotificationData;
  [NotificationType.System]: EmptyNotificationData;
}

export type CreateNotificationDataFor<T extends NotificationType> =
  CreateNotificationDataByType[T];

export type NotificationDataFor<T extends NotificationType> =
  NotificationDataByType[T];

export interface NotificationView<
  T extends NotificationType = NotificationType,
> {
  id: string;
  type: T;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data: NotificationDataFor<T>;
}

export type AnyNotificationView = {
  [K in NotificationType]: NotificationView<K>;
}[NotificationType];

export interface CreateNotificationInput<
  T extends NotificationType = NotificationType,
> {
  userId: string;
  type: T;
  title: string;
  body: string;
  data?: CreateNotificationDataFor<T> | null;
}

export function toNotificationJson(
  data: CreateNotificationInput["data"],
): Prisma.InputJsonValue | undefined {
  if (!data) {
    return undefined;
  }

  return data as Prisma.InputJsonValue;
}

function isJsonObject(
  value: Prisma.JsonValue | null,
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getString(data: Prisma.JsonObject, key: string): string | undefined {
  return typeof data[key] === "string" ? data[key] : undefined;
}

function sanitizeOwnedRelationshipId(
  data: Prisma.JsonObject,
  ownedRelationshipIds: ReadonlySet<string>,
): string | undefined {
  const relationshipId = getString(data, "relationshipId");

  return relationshipId && ownedRelationshipIds.has(relationshipId)
    ? relationshipId
    : undefined;
}

function isContactRequestSourceType(
  value: string,
): value is ContactRequestSourceType {
  return Object.values(ContactRequestSourceType).includes(
    value as ContactRequestSourceType,
  );
}

function sanitizeRequestNotificationData(
  data: Prisma.JsonObject,
): RequestReceivedNotificationData {
  const sourceType = getString(data, "sourceType");

  return {
    ...(sourceType && isContactRequestSourceType(sourceType)
      ? { sourceType }
      : {}),
  };
}

function sanitizeRequestApprovedNotificationData(
  data: Prisma.JsonObject,
  ownedRelationshipIds: ReadonlySet<string>,
): RequestApprovedNotificationData {
  const relationshipId = sanitizeOwnedRelationshipId(
    data,
    ownedRelationshipIds,
  );

  return {
    ...(relationshipId ? { relationshipId } : {}),
  };
}

function sanitizeInstantConnectNotificationData(
  data: Prisma.JsonObject,
  ownedRelationshipIds: ReadonlySet<string>,
): InstantConnectNotificationData {
  const relationshipId = sanitizeOwnedRelationshipId(
    data,
    ownedRelationshipIds,
  );

  if (getString(data, "sourcePersonaId")) {
    return {};
  }

  return {
    ...(relationshipId ? { relationshipId } : {}),
  };
}

function sanitizeEventJoinedNotificationData(): EventJoinedNotificationData {
  return {};
}

export function extractRelationshipId(
  data: Prisma.JsonValue | null,
): string | null {
  if (!isJsonObject(data)) {
    return null;
  }

  return typeof data.relationshipId === "string" ? data.relationshipId : null;
}

export function sanitizeNotificationData<T extends NotificationType>(
  type: T,
  data: Prisma.JsonValue | null,
  ownedRelationshipIds: ReadonlySet<string>,
): NotificationDataFor<T> {
  if (!isJsonObject(data)) {
    return {} as NotificationDataFor<T>;
  }

  switch (type) {
    case NotificationType.RequestReceived:
    case NotificationType.EventRequest:
      return sanitizeRequestNotificationData(data) as NotificationDataFor<T>;
    case NotificationType.RequestApproved:
      return sanitizeRequestApprovedNotificationData(
        data,
        ownedRelationshipIds,
      ) as NotificationDataFor<T>;
    case NotificationType.InstantConnect:
      return sanitizeInstantConnectNotificationData(
        data,
        ownedRelationshipIds,
      ) as NotificationDataFor<T>;
    case NotificationType.EventJoined:
      return sanitizeEventJoinedNotificationData() as NotificationDataFor<T>;
    case NotificationType.System:
      return {} as NotificationDataFor<T>;
  }
}

export function createNotificationView<T extends NotificationType>(input: {
  id: string;
  type: T;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  data: NotificationDataFor<T>;
}): NotificationView<T> {
  return input;
}
