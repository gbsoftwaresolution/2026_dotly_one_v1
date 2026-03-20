import { Injectable, NotFoundException } from "@nestjs/common";
import {
  NotificationType as PrismaNotificationType,
  Prisma,
} from "@prisma/client";

import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";

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

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue | null;
}

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

    return {
      notifications: notifications.map(toNotificationView),
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

    return toNotificationView(updatedNotification);
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

    await notificationClient.notification.create({
      data: {
        userId: input.userId,
        type: toPrismaNotificationType(input.type),
        title: input.title.trim(),
        body: input.body.trim(),
        data: input.data ?? undefined,
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
) {
  return {
    id: notification.id,
    type: toApiNotificationType(notification.type),
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    data: notification.data ?? {},
  };
}
