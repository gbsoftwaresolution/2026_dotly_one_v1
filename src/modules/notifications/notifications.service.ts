import { Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationType as PrismaNotificationType,
  Prisma,
} from "../../generated/prisma/client";

import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";
import {
  type AnyNotificationView,
  type CreateNotificationInput,
  createNotificationView,
  extractRelationshipId,
  sanitizeNotificationData,
  toNotificationJson,
} from "./notification-payloads";

const DEFAULT_NOTIFICATION_LIMIT = 20;

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  async findAll(userId: string, query?: { limit?: number; offset?: number }) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prismaService.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: query?.limit ?? DEFAULT_NOTIFICATION_LIMIT,
        skip: query?.offset ?? 0,
        select: notificationSelect,
      }),
      this.prismaService.notification.count({ where: { userId } }),
      this.prismaService.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const sanitizedNotifications = await this.sanitizeNotificationViews(
      userId,
      notifications,
    );

    return {
      notifications: sanitizedNotifications,
      total,
      unreadCount,
    };
  }

  async countUnread(userId: string) {
    const unreadCount = await this.prismaService.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prismaService.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    const updatedNotification = await this.prismaService.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        isRead: true,
      },
      select: notificationSelect,
    });

    return this.sanitizeNotificationView(userId, updatedNotification);
  }

  async markAllAsRead(userId: string) {
    const result = await this.prismaService.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async create(
    input: CreateNotificationInput,
    client?: NotificationClient,
  ): Promise<void> {
    const notificationClient = client ?? this.prismaService;
    const sanitizedInputData = await this.sanitizeNotificationInputData(
      input.userId,
      input.data ?? null,
      notificationClient,
    );

    await notificationClient.notification.create({
      data: {
        userId: input.userId,
        type: toPrismaNotificationType(input.type),
        title: input.title.trim(),
        body: input.body.trim(),
        data: toNotificationJson(sanitizedInputData),
      },
    });
  }

  async createSafe(
    input: CreateNotificationInput,
    client?: NotificationClient,
  ): Promise<void> {
    try {
      await this.create(input, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Notification skipped for user ${input.userId}: ${message}`,
        "NotificationsService",
      );
    }
  }

  private async sanitizeNotificationViews(
    userId: string,
    notifications: Prisma.NotificationGetPayload<{
      select: typeof notificationSelect;
    }>[],
  ): Promise<AnyNotificationView[]> {
    const relationshipIds = notifications
      .map((notification) => extractRelationshipId(notification.data))
      .filter(
        (relationshipId): relationshipId is string =>
          typeof relationshipId === "string",
      );

    const ownedRelationshipIds = await this.getOwnedRelationshipIds(
      userId,
      relationshipIds,
    );

    return notifications.map((notification) =>
      toNotificationView(notification, ownedRelationshipIds),
    );
  }

  private async sanitizeNotificationView(
    userId: string,
    notification: Prisma.NotificationGetPayload<{
      select: typeof notificationSelect;
    }>,
  ): Promise<AnyNotificationView> {
    const relationshipId = extractRelationshipId(notification.data);
    const ownedRelationshipIds = await this.getOwnedRelationshipIds(
      userId,
      relationshipId ? [relationshipId] : [],
    );

    return toNotificationView(notification, ownedRelationshipIds);
  }

  private async getOwnedRelationshipIds(
    userId: string,
    relationshipIds: string[],
  ): Promise<Set<string>> {
    const uniqueRelationshipIds = [...new Set(relationshipIds)];

    if (uniqueRelationshipIds.length === 0) {
      return new Set<string>();
    }

    const relationships = await this.prismaService.contactRelationship.findMany(
      {
        where: {
          ownerUserId: userId,
          id: {
            in: uniqueRelationshipIds,
          },
        },
        select: {
          id: true,
        },
      },
    );

    return new Set(relationships.map((relationship) => relationship.id));
  }

  private async sanitizeNotificationInputData(
    userId: string,
    data: CreateNotificationInput["data"],
    client: NotificationClient,
  ): Promise<CreateNotificationInput["data"]> {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return data;
    }

    const relationshipId =
      typeof (data as { relationshipId?: unknown }).relationshipId === "string"
        ? (data as { relationshipId: string }).relationshipId
        : null;

    if (relationshipId === null) {
      return data;
    }

    const ownedRelationshipIds = await this.getOwnedRelationshipIdsForClient(
      client,
      userId,
      [relationshipId],
    );

    if (ownedRelationshipIds.has(relationshipId)) {
      return data;
    }

    const notificationData = data as unknown as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { relationshipId: _relationshipId, ...sanitizedData } =
      notificationData;

    return sanitizedData as CreateNotificationInput["data"];
  }

  private async getOwnedRelationshipIdsForClient(
    client: NotificationClient,
    userId: string,
    relationshipIds: string[],
  ): Promise<Set<string>> {
    const uniqueRelationshipIds = [...new Set(relationshipIds)];

    if (uniqueRelationshipIds.length === 0) {
      return new Set<string>();
    }

    const relationships = await client.contactRelationship.findMany({
      where: {
        ownerUserId: userId,
        id: {
          in: uniqueRelationshipIds,
        },
      },
      select: {
        id: true,
      },
    });

    return new Set(relationships.map((relationship) => relationship.id));
  }
}

function toPrismaNotificationType(
  type: NotificationType,
): PrismaNotificationType {
  switch (type) {
    case NotificationType.RequestReceived:
      return PrismaNotificationType.REQUEST_RECEIVED;
    case NotificationType.RequestApproved:
      return PrismaNotificationType.REQUEST_APPROVED;
    case NotificationType.InstantConnect:
      return PrismaNotificationType.INSTANT_CONNECT;
    case NotificationType.EventJoined:
      return PrismaNotificationType.EVENT_JOINED;
    case NotificationType.EventRequest:
      return PrismaNotificationType.EVENT_REQUEST;
    case NotificationType.System:
      return PrismaNotificationType.SYSTEM;
  }

  throw new Error("Unsupported notification type");
}

function toApiNotificationType(type: PrismaNotificationType): NotificationType {
  switch (type) {
    case PrismaNotificationType.REQUEST_RECEIVED:
      return NotificationType.RequestReceived;
    case PrismaNotificationType.REQUEST_APPROVED:
      return NotificationType.RequestApproved;
    case PrismaNotificationType.INSTANT_CONNECT:
      return NotificationType.InstantConnect;
    case PrismaNotificationType.EVENT_JOINED:
      return NotificationType.EventJoined;
    case PrismaNotificationType.EVENT_REQUEST:
      return NotificationType.EventRequest;
    case PrismaNotificationType.SYSTEM:
      return NotificationType.System;
  }

  throw new Error("Unsupported notification type");
}

function toNotificationView(
  notification: Prisma.NotificationGetPayload<{
    select: typeof notificationSelect;
  }>,
  ownedRelationshipIds: ReadonlySet<string> = new Set<string>(),
): AnyNotificationView {
  const type = toApiNotificationType(notification.type);

  return createNotificationView({
    id: notification.id,
    type,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    data: sanitizeNotificationData(
      type,
      notification.data,
      ownedRelationshipIds,
    ),
  }) as AnyNotificationView;
}
