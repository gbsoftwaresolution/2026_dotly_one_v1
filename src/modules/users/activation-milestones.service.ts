import { Injectable, NotFoundException } from "@nestjs/common";

import {
  AnalyticsEventType as PrismaAnalyticsEventType,
  Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";

export type ActivationMilestoneKey =
  | "firstPersonaCreated"
  | "firstQrOpened"
  | "firstShareCompleted"
  | "firstRequestReceived";

export type ActivationNudgeQueue = "requests" | "inbox";

export interface UserActivationFirstResponseNudge {
  queue: ActivationNudgeQueue;
  triggeredAt: string;
  clearedAt: string | null;
}

export interface UserActivationMilestones {
  firstPersonaCreatedAt: string | null;
  firstQrOpenedAt: string | null;
  firstShareCompletedAt: string | null;
  firstRequestReceivedAt: string | null;
}

export interface UserActivationState {
  milestones: UserActivationMilestones;
  completedCount: number;
  nextMilestoneKey: ActivationMilestoneKey | null;
  firstResponseNudge: UserActivationFirstResponseNudge | null;
}

interface DateActivationMilestones {
  firstPersonaCreatedAt: Date | null;
  firstQrOpenedAt: Date | null;
  firstShareCompletedAt: Date | null;
  firstRequestReceivedAt: Date | null;
}

interface DateActivationFirstResponseNudge {
  queue: ActivationNudgeQueue;
  triggeredAt: Date;
  clearedAt: Date | null;
}

interface StoredActivationState {
  milestones: DateActivationMilestones;
  firstResponseNudge: DateActivationFirstResponseNudge | null;
}

const activationMilestoneOrder: ActivationMilestoneKey[] = [
  "firstPersonaCreated",
  "firstQrOpened",
  "firstShareCompleted",
  "firstRequestReceived",
];

const emptyDateActivationMilestones: DateActivationMilestones = {
  firstPersonaCreatedAt: null,
  firstQrOpenedAt: null,
  firstShareCompletedAt: null,
  firstRequestReceivedAt: null,
};

export const emptyUserActivationState: UserActivationState = {
  milestones: {
    firstPersonaCreatedAt: null,
    firstQrOpenedAt: null,
    firstShareCompletedAt: null,
    firstRequestReceivedAt: null,
  },
  completedCount: 0,
  nextMilestoneKey: "firstPersonaCreated",
  firstResponseNudge: null,
};

export type ActivationMilestonesTracker = Pick<
  ActivationMilestonesService,
  | "getUserActivation"
  | "markFirstPersonaCreated"
  | "markFirstQrOpened"
  | "markFirstShareCompletedForPersona"
  | "markFirstRequestReceived"
  | "clearFirstResponseNudge"
>;

export const noopActivationMilestonesService: ActivationMilestonesTracker = {
  getUserActivation: async () => emptyUserActivationState,
  markFirstPersonaCreated: async () => {},
  markFirstQrOpened: async () => {},
  markFirstShareCompletedForPersona: async () => {},
  markFirstRequestReceived: async () => {},
  clearFirstResponseNudge: async () => {},
};

export function isActivationNudgeQueue(
  value: string,
): value is ActivationNudgeQueue {
  return value === "requests" || value === "inbox";
}

function parseStoredDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseStoredFirstResponseNudge(
  value: unknown,
): DateActivationFirstResponseNudge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const queue = record.queue;

  if (typeof queue !== "string" || !isActivationNudgeQueue(queue)) {
    return null;
  }

  const triggeredAt = parseStoredDate(record.triggeredAt);

  if (!triggeredAt) {
    return null;
  }

  return {
    queue,
    triggeredAt,
    clearedAt: parseStoredDate(record.clearedAt),
  };
}

function normalizeStoredActivation(value: unknown): StoredActivationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      milestones: { ...emptyDateActivationMilestones },
      firstResponseNudge: null,
    };
  }

  const record = value as Record<string, unknown>;

  return {
    milestones: {
      firstPersonaCreatedAt: parseStoredDate(record.firstPersonaCreatedAt),
      firstQrOpenedAt: parseStoredDate(record.firstQrOpenedAt),
      firstShareCompletedAt: parseStoredDate(record.firstShareCompletedAt),
      firstRequestReceivedAt: parseStoredDate(record.firstRequestReceivedAt),
    },
    firstResponseNudge: parseStoredFirstResponseNudge(record.firstResponseNudge),
  };
}

function serializeActivation(
  activation: StoredActivationState,
): Prisma.InputJsonValue {
  return {
    firstPersonaCreatedAt:
      activation.milestones.firstPersonaCreatedAt?.toISOString() ?? null,
    firstQrOpenedAt: activation.milestones.firstQrOpenedAt?.toISOString() ?? null,
    firstShareCompletedAt:
      activation.milestones.firstShareCompletedAt?.toISOString() ?? null,
    firstRequestReceivedAt:
      activation.milestones.firstRequestReceivedAt?.toISOString() ?? null,
    firstResponseNudge: activation.firstResponseNudge
      ? {
          queue: activation.firstResponseNudge.queue,
          triggeredAt: activation.firstResponseNudge.triggeredAt.toISOString(),
          clearedAt:
            activation.firstResponseNudge.clearedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function mergeFirstTimestamp(
  currentValue: Date | null,
  nextValue: Date,
): Date {
  if (!currentValue) {
    return nextValue;
  }

  return currentValue.getTime() <= nextValue.getTime() ? currentValue : nextValue;
}

function milestonesEqual(
  left: DateActivationMilestones,
  right: DateActivationMilestones,
): boolean {
  return (
    left.firstPersonaCreatedAt?.getTime() === right.firstPersonaCreatedAt?.getTime() &&
    left.firstQrOpenedAt?.getTime() === right.firstQrOpenedAt?.getTime() &&
    left.firstShareCompletedAt?.getTime() === right.firstShareCompletedAt?.getTime() &&
    left.firstRequestReceivedAt?.getTime() === right.firstRequestReceivedAt?.getTime()
  );
}

function firstResponseNudgeEqual(
  left: DateActivationFirstResponseNudge | null,
  right: DateActivationFirstResponseNudge | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.queue === right.queue &&
    left.triggeredAt.getTime() === right.triggeredAt.getTime() &&
    left.clearedAt?.getTime() === right.clearedAt?.getTime()
  );
}

function activationStateEqual(
  left: StoredActivationState,
  right: StoredActivationState,
) {
  return (
    milestonesEqual(left.milestones, right.milestones) &&
    firstResponseNudgeEqual(left.firstResponseNudge, right.firstResponseNudge)
  );
}

function toActivationMilestoneValue(
  milestones: DateActivationMilestones,
  key: ActivationMilestoneKey,
): Date | null {
  switch (key) {
    case "firstPersonaCreated":
      return milestones.firstPersonaCreatedAt;
    case "firstQrOpened":
      return milestones.firstQrOpenedAt;
    case "firstShareCompleted":
      return milestones.firstShareCompletedAt;
    case "firstRequestReceived":
      return milestones.firstRequestReceivedAt;
  }
}

function toUserActivationState(
  activation: StoredActivationState,
): UserActivationState {
  const { milestones, firstResponseNudge } = activation;
  const completedCount = activationMilestoneOrder.filter((key) =>
    Boolean(toActivationMilestoneValue(milestones, key)),
  ).length;
  const nextMilestoneKey =
    activationMilestoneOrder.find(
      (key) => !toActivationMilestoneValue(milestones, key),
    ) ?? null;

  return {
    milestones: {
      firstPersonaCreatedAt:
        milestones.firstPersonaCreatedAt?.toISOString() ?? null,
      firstQrOpenedAt: milestones.firstQrOpenedAt?.toISOString() ?? null,
      firstShareCompletedAt:
        milestones.firstShareCompletedAt?.toISOString() ?? null,
      firstRequestReceivedAt:
        milestones.firstRequestReceivedAt?.toISOString() ?? null,
    },
    completedCount,
    nextMilestoneKey,
    firstResponseNudge: firstResponseNudge
      ? {
          queue: firstResponseNudge.queue,
          triggeredAt: firstResponseNudge.triggeredAt.toISOString(),
          clearedAt: firstResponseNudge.clearedAt?.toISOString() ?? null,
        }
      : null,
  };
}

@Injectable()
export class ActivationMilestonesService {
  constructor(private readonly prismaService: PrismaService) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async getUserActivation(userId: string): Promise<UserActivationState> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        lastUsedPersonaId: true,
        activationMilestonesJson: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const storedActivation = normalizeStoredActivation(
      user.activationMilestonesJson,
    );
    const storedMilestones = storedActivation.milestones;
    const personas = await this.prisma.persona.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    const personaIds = personas.map((persona: { id: string }) => persona.id);

    const [firstQrToken, firstShareEvent, firstIncomingRequest] =
      personaIds.length > 0
        ? await Promise.all([
            this.prisma.qRAccessToken.findFirst({
              where: {
                personaId: {
                  in: personaIds,
                },
              },
              orderBy: {
                createdAt: "asc",
              },
              select: {
                createdAt: true,
              },
            }),
            this.prisma.analyticsEvent.findFirst({
              where: {
                personaId: {
                  in: personaIds,
                },
                eventType: {
                  in: [
                    PrismaAnalyticsEventType.PROFILE_VIEW,
                    PrismaAnalyticsEventType.QR_SCAN,
                  ],
                },
              },
              orderBy: {
                createdAt: "asc",
              },
              select: {
                createdAt: true,
              },
            }),
            this.prisma.contactRequest.findFirst({
              where: {
                toUserId: userId,
              },
              orderBy: {
                createdAt: "asc",
              },
              select: {
                createdAt: true,
              },
            }),
          ])
        : [null, null, null];

    const firstPersonaCreatedAt =
      storedMilestones.firstPersonaCreatedAt ?? personas[0]?.createdAt ?? null;
    const firstRequestReceivedAt =
      storedMilestones.firstRequestReceivedAt ??
      firstIncomingRequest?.createdAt ??
      null;
    const firstShareCompletedAt =
      storedMilestones.firstShareCompletedAt ??
      firstShareEvent?.createdAt ??
      firstRequestReceivedAt ??
      null;

    let firstQrOpenedAt =
      storedMilestones.firstQrOpenedAt ?? firstQrToken?.createdAt ?? null;

    if (!firstQrOpenedAt && firstShareCompletedAt) {
      firstQrOpenedAt = firstShareCompletedAt;
    }

    if (!firstQrOpenedAt && user.lastUsedPersonaId && firstPersonaCreatedAt) {
      firstQrOpenedAt = firstPersonaCreatedAt;
    }

    return toUserActivationState({
      milestones: {
        firstPersonaCreatedAt,
        firstQrOpenedAt,
        firstShareCompletedAt,
        firstRequestReceivedAt,
      },
      firstResponseNudge: storedActivation.firstResponseNudge,
    });
  }

  async markFirstPersonaCreated(userId: string, occurredAt = new Date()) {
    await this.updateActivationState(userId, (current) => ({
      ...current,
      milestones: {
        ...current.milestones,
        firstPersonaCreatedAt: mergeFirstTimestamp(
          current.milestones.firstPersonaCreatedAt,
          occurredAt,
        ),
      },
    }));
  }

  async markFirstQrOpened(userId: string, occurredAt = new Date()) {
    await this.updateActivationState(userId, (current) => ({
      ...current,
      milestones: {
        ...current.milestones,
        firstQrOpenedAt: mergeFirstTimestamp(
          current.milestones.firstQrOpenedAt,
          occurredAt,
        ),
      },
    }));
  }

  async markFirstShareCompletedForPersona(
    personaId: string,
    options?: {
      actorUserId?: string | null;
      occurredAt?: Date;
    },
  ) {
    const persona = await this.prisma.persona.findUnique({
      where: {
        id: personaId,
      },
      select: {
        userId: true,
      },
    });

    if (!persona) {
      return;
    }

    if (options?.actorUserId && options.actorUserId === persona.userId) {
      return;
    }

    await this.updateActivationState(persona.userId, (current) => ({
      ...current,
      milestones: {
        ...current.milestones,
        firstShareCompletedAt: mergeFirstTimestamp(
          current.milestones.firstShareCompletedAt,
          options?.occurredAt ?? new Date(),
        ),
      },
    }));
  }

  async markFirstRequestReceived(userId: string, occurredAt = new Date()) {
    await this.updateActivationState(userId, (current) => ({
      milestones: {
        ...current.milestones,
        firstShareCompletedAt: mergeFirstTimestamp(
          current.milestones.firstShareCompletedAt,
          occurredAt,
        ),
        firstRequestReceivedAt: mergeFirstTimestamp(
          current.milestones.firstRequestReceivedAt,
          occurredAt,
        ),
      },
      firstResponseNudge:
        current.firstResponseNudge ?? {
          queue: "requests",
          triggeredAt: occurredAt,
          clearedAt: null,
        },
    }));
  }

  async clearFirstResponseNudge(
    userId: string,
    queue: ActivationNudgeQueue,
    clearedAt = new Date(),
  ) {
    await this.updateActivationState(userId, (current) => {
      if (
        !current.firstResponseNudge ||
        current.firstResponseNudge.queue !== queue ||
        current.firstResponseNudge.clearedAt
      ) {
        return current;
      }

      return {
        ...current,
        firstResponseNudge: {
          ...current.firstResponseNudge,
          clearedAt,
        },
      };
    });
  }

  private async updateActivationState(
    userId: string,
    updater: (current: StoredActivationState) => StoredActivationState,
  ) {
    await this.prismaService.$transaction(async (tx) => {
      const user = await (tx as any).user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          activationMilestonesJson: true,
        },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const current = normalizeStoredActivation(user.activationMilestonesJson);
      const next = updater(current);

      if (activationStateEqual(current, next)) {
        return;
      }

      await (tx as any).user.update({
        where: {
          id: userId,
        },
        data: {
          activationMilestonesJson: serializeActivation(next),
        },
      });
    });
  }
}