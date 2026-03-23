import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  FollowUpStatus as PrismaFollowUpStatus,
  Prisma,
} from "@prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { FollowUpStatus } from "../../common/enums/follow-up-status.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { CreateFollowUpDto } from "./dto/create-follow-up.dto";
import { ListFollowUpsQueryDto } from "./dto/list-follow-ups-query.dto";
import { UpdateFollowUpDto } from "./dto/update-follow-up.dto";

const UPCOMING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

const followUpTargetPersonaSelect = {
  id: true,
  username: true,
  fullName: true,
  jobTitle: true,
  companyName: true,
  profilePhotoUrl: true,
} satisfies Prisma.PersonaSelect;

const followUpRelationshipListSelect = {
  id: true,
  state: true,
  sourceType: true,
  connectionContext: true,
  memories: {
    orderBy: [{ metAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      contextLabel: true,
      sourceLabel: true,
    },
  },
  targetPersona: {
    select: followUpTargetPersonaSelect,
  },
} satisfies Prisma.ContactRelationshipSelect;

const followUpRelationshipDetailSelect = {
  ...followUpRelationshipListSelect,
  accessEndAt: true,
} satisfies Prisma.ContactRelationshipSelect;

const followUpListSelect = {
  id: true,
  relationshipId: true,
  remindAt: true,
  triggeredAt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  relationship: {
    select: followUpRelationshipListSelect,
  },
} satisfies Prisma.FollowUpSelect;

const followUpDetailSelect = {
  id: true,
  ownerUserId: true,
  relationshipId: true,
  remindAt: true,
  triggeredAt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  relationship: {
    select: followUpRelationshipDetailSelect,
  },
} satisfies Prisma.FollowUpSelect;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type FollowUpListRecord = Prisma.FollowUpGetPayload<{
  select: typeof followUpListSelect;
}>;

type FollowUpDetailRecord = Prisma.FollowUpGetPayload<{
  select: typeof followUpDetailSelect;
}>;

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  async createFollowUp(userId: string, dto: CreateFollowUpDto) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForCreate(
        tx,
        userId,
        dto.relationshipId,
      );

      const createdFollowUp = await tx.followUp.create({
        data: {
          ownerUserId: userId,
          relationshipId: relationship.id,
          remindAt: toRemindAtDate(dto.remindAt),
          note: dto.note ?? null,
        },
        select: followUpDetailSelect,
      });

      return this.toFollowUpView(createdFollowUp);
    });
  }

  async listFollowUps(userId: string, query: ListFollowUpsQueryDto) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);

    const now = new Date();
    const baseWhere = {
      ownerUserId: userId,
      ...buildActiveRelationshipFollowUpWhere(now, userId),
      ...(query.relationshipId
        ? {
            relationshipId: query.relationshipId,
          }
        : {}),
      ...(query.upcoming === true
        ? {
            status: PrismaFollowUpStatus.PENDING,
            remindAt: {
              gte: now,
            },
          }
        : {}),
    } satisfies Prisma.FollowUpWhereInput;

    const followUps = await this.prismaService.followUp.findMany({
      where: {
        ...baseWhere,
        ...(query.status
          ? {
              status: toPrismaFollowUpStatus(query.status),
            }
          : {}),
      },
      orderBy:
        query.status === FollowUpStatus.Pending
          ? [{ remindAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]
          : query.status
            ? [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }]
            : [
                { status: "asc" },
                { remindAt: "asc" },
                { updatedAt: "desc" },
                { createdAt: "asc" },
                { id: "asc" },
              ],
      select: followUpListSelect,
    });

    return followUps.map((followUp) => this.toFollowUpView(followUp, now));
  }

  async listDueFollowUps(userId: string, limit?: number) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);

    const now = new Date();
    const followUps = await this.prismaService.followUp.findMany({
      where: {
        ownerUserId: userId,
        ...buildActiveRelationshipFollowUpWhere(now, userId),
        status: PrismaFollowUpStatus.PENDING,
        remindAt: {
          lte: now,
        },
      },
      ...(limit !== undefined
        ? {
            take: limit,
          }
        : {}),
      orderBy: [{ remindAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: followUpListSelect,
    });

    return followUps.map((followUp) => this.toFollowUpView(followUp, now));
  }

  async getFollowUp(userId: string, id: string) {
    await this.relationshipsService.expireOwnedExpiredRelationships?.(userId);

    const followUp = await this.getOwnedActiveFollowUp(
      this.prismaService,
      userId,
      id,
    );
    return this.toFollowUpView(followUp);
  }

  async markTriggeredIfDue(userId: string, id: string) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);

    const now = new Date();
    await this.prismaService.followUp.updateMany({
      where: {
        id,
        ownerUserId: userId,
        ...buildActiveRelationshipFollowUpWhere(now, userId),
        status: PrismaFollowUpStatus.PENDING,
        triggeredAt: null,
        remindAt: {
          lte: now,
        },
      },
      data: {
        triggeredAt: now,
      },
    });

    const followUp = await this.getOwnedFollowUp(
      this.prismaService,
      userId,
      id,
    );

    return this.toFollowUpView(followUp, now);
  }

  async processDueFollowUps(options?: { userId?: string; limit?: number }) {
    const now = new Date();

    await this.relationshipsService.expireExpiredRelationships(options?.userId);

    if (options?.limit !== undefined) {
      const dueFollowUps = await this.prismaService.followUp.findMany({
        where: {
          ...(options.userId
            ? {
                ownerUserId: options.userId,
              }
            : {}),
          ...buildActiveRelationshipFollowUpWhere(now, options?.userId),
          status: PrismaFollowUpStatus.PENDING,
          triggeredAt: null,
          remindAt: {
            lte: now,
          },
        },
        orderBy: [{ remindAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        take: options.limit,
        select: {
          id: true,
        },
      });

      if (dueFollowUps.length === 0) {
        return {
          processedCount: 0,
        };
      }

      const result = await this.prismaService.followUp.updateMany({
        where: {
          id: {
            in: dueFollowUps.map((followUp) => followUp.id),
          },
          ...buildActiveRelationshipFollowUpWhere(now, options?.userId),
          status: PrismaFollowUpStatus.PENDING,
          triggeredAt: null,
          remindAt: {
            lte: now,
          },
        },
        data: {
          triggeredAt: now,
        },
      });

      return {
        processedCount: result.count,
      };
    }

    const result = await this.prismaService.followUp.updateMany({
      where: {
        ...(options?.userId
          ? {
              ownerUserId: options.userId,
            }
          : {}),
        ...buildActiveRelationshipFollowUpWhere(now, options?.userId),
        status: PrismaFollowUpStatus.PENDING,
        triggeredAt: null,
        remindAt: {
          lte: now,
        },
      },
      data: {
        triggeredAt: now,
      },
    });

    return {
      processedCount: result.count,
    };
  }

  async getFollowUpSummaryForRelationship(
    userId: string,
    relationshipId: string,
  ) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);

    const now = new Date();
    const where = {
      ownerUserId: userId,
      relationshipId,
      ...buildActiveRelationshipFollowUpWhere(now, userId),
      status: PrismaFollowUpStatus.PENDING,
    } satisfies Prisma.FollowUpWhereInput;

    const [aggregate, nextFollowUp] = await Promise.all([
      this.prismaService.followUp.aggregate({
        where,
        _count: {
          id: true,
        },
        _min: {
          remindAt: true,
        },
      }),
      this.prismaService.followUp.findFirst({
        where,
        orderBy: [{ remindAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          remindAt: true,
          triggeredAt: true,
          status: true,
        },
      }),
    ]);

    const pendingFollowUpCount = aggregate._count.id;
    const metadata = nextFollowUp
      ? this.buildFollowUpMetadata(nextFollowUp, now)
      : buildEmptyFollowUpMetadata();

    return {
      hasPendingFollowUp: pendingFollowUpCount > 0,
      nextFollowUpAt: aggregate._min.remindAt ?? null,
      pendingFollowUpCount,
      ...metadata,
    };
  }

  async updateFollowUp(userId: string, id: string, dto: UpdateFollowUpDto) {
    return this.prismaService.$transaction(async (tx) => {
      const followUp = await this.getOwnedActiveFollowUp(tx, userId, id);
      this.assertPending(followUp, "Only pending follow-ups can be updated");

      const data: Prisma.FollowUpUpdateInput = {};

      if (dto.remindAt !== undefined) {
        data.remindAt = toRemindAtDate(dto.remindAt);
        data.triggeredAt = null;
      }

      if (dto.note !== undefined) {
        data.note = dto.note;
      }

      if (Object.keys(data).length === 0) {
        return this.toFollowUpView(followUp);
      }

      const updatedFollowUp = await tx.followUp.update({
        where: {
          id: followUp.id,
        },
        data,
        select: followUpDetailSelect,
      });

      return this.toFollowUpView(updatedFollowUp);
    });
  }

  async completeFollowUp(userId: string, id: string) {
    return this.transitionFollowUpStatus(
      userId,
      id,
      PrismaFollowUpStatus.COMPLETED,
      "Only pending follow-ups can be completed",
    );
  }

  async cancelFollowUp(userId: string, id: string) {
    return this.transitionFollowUpStatus(
      userId,
      id,
      PrismaFollowUpStatus.CANCELLED,
      "Only pending follow-ups can be cancelled",
    );
  }

  private async transitionFollowUpStatus(
    userId: string,
    id: string,
    nextStatus: PrismaFollowUpStatus,
    conflictMessage: string,
  ) {
    return this.prismaService.$transaction(async (tx) => {
      const followUp = await this.getOwnedActiveFollowUp(tx, userId, id);
      this.assertPending(followUp, conflictMessage);

      const updatedFollowUp = await tx.followUp.update({
        where: {
          id: followUp.id,
        },
        data: {
          status: nextStatus,
          completedAt:
            nextStatus === PrismaFollowUpStatus.COMPLETED ? new Date() : null,
        },
        select: followUpDetailSelect,
      });

      return this.toFollowUpView(updatedFollowUp);
    });
  }

  private async getOwnedRelationshipForCreate(
    prisma: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const relationshipDelegate = prisma.contactRelationship as unknown as {
      findFirst?: (args: {
        where: { id: string; ownerUserId: string };
        select: {
          id: true;
          state: true;
          accessEndAt: true;
        };
      }) => Promise<{
        id: string;
        state: PrismaContactRelationshipState;
        accessEndAt: Date | null;
      } | null>;
      findUnique?: (args: {
        where: { id: string };
        select: {
          id: true;
          ownerUserId: true;
          state: true;
          accessEndAt: true;
        };
      }) => Promise<{
        id: string;
        ownerUserId: string;
        state: PrismaContactRelationshipState;
        accessEndAt: Date | null;
      } | null>;
    };

    const relationship =
      typeof relationshipDelegate.findFirst === "function"
        ? await relationshipDelegate.findFirst({
            where: {
              id: relationshipId,
              ownerUserId: userId,
            },
            select: {
              id: true,
              state: true,
              accessEndAt: true,
            },
          })
        : await relationshipDelegate.findUnique?.({
            where: {
              id: relationshipId,
            },
            select: {
              id: true,
              ownerUserId: true,
              state: true,
              accessEndAt: true,
            },
          });

    if (
      !relationship ||
      ("ownerUserId" in relationship && relationship.ownerUserId !== userId)
    ) {
      throw new NotFoundException("Relationship not found");
    }

    const normalizedRelationship =
      await this.relationshipsService.expireRelationshipIfNeeded(
        prisma,
        relationship,
      );

    if (
      normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
    ) {
      throw new ConflictException("Relationship is no longer active");
    }

    return normalizedRelationship;
  }

  private async getOwnedFollowUp(
    prisma: PrismaClientLike,
    userId: string,
    id: string,
  ) {
    const followUpDelegate = prisma.followUp as unknown as {
      findFirst?: (args: {
        where: { id: string; ownerUserId: string };
        select: typeof followUpDetailSelect;
      }) => Promise<FollowUpDetailRecord | null>;
      findUnique?: (args: {
        where: { id: string };
        select: typeof followUpDetailSelect;
      }) => Promise<FollowUpDetailRecord | null>;
    };

    const followUp =
      typeof followUpDelegate.findFirst === "function"
        ? await followUpDelegate.findFirst({
            where: {
              id,
              ownerUserId: userId,
            },
            select: followUpDetailSelect,
          })
        : await followUpDelegate.findUnique?.({
            where: {
              id,
            },
            select: followUpDetailSelect,
          });

    if (!followUp || followUp.ownerUserId !== userId) {
      throw new NotFoundException("Follow-up not found");
    }

    return followUp;
  }

  private async getOwnedActiveFollowUp(
    prisma: PrismaClientLike,
    userId: string,
    id: string,
  ) {
    const followUp = await this.getOwnedFollowUp(prisma, userId, id);

    if (!followUp.relationship) {
      return followUp;
    }

    const normalizedRelationship =
      await this.relationshipsService.expireRelationshipIfNeeded?.(
        prisma,
        followUp.relationship,
      );

    if (!normalizedRelationship) {
      return followUp;
    }

    if (
      normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
    ) {
      throw new ConflictException("Relationship is no longer active");
    }

    return {
      ...followUp,
      relationship: normalizedRelationship,
    };
  }

  private assertPending(followUp: FollowUpDetailRecord, message: string) {
    if (followUp.status !== PrismaFollowUpStatus.PENDING) {
      throw new ConflictException(message);
    }
  }

  private toFollowUpView(
    followUp: FollowUpListRecord | FollowUpDetailRecord,
    now = new Date(),
  ) {
    const relationship = followUp.relationship;

    return {
      id: followUp.id,
      relationshipId: followUp.relationshipId,
      remindAt: followUp.remindAt,
      triggeredAt: followUp.triggeredAt,
      status: toApiFollowUpStatus(followUp.status),
      note: followUp.note,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
      completedAt: followUp.completedAt,
      relationship: {
        sourceType: relationship
          ? toApiContactRequestSourceType(relationship.sourceType)
          : undefined,
        sourceLabel: relationship
          ? buildRelationshipSourceLabel(relationship)
          : undefined,
        targetPersona: relationship
          ? {
              id: relationship.targetPersona.id,
              username: relationship.targetPersona.username,
              fullName: relationship.targetPersona.fullName,
              jobTitle: relationship.targetPersona.jobTitle,
              companyName: relationship.targetPersona.companyName,
              profilePhotoUrl: relationship.targetPersona.profilePhotoUrl,
            }
          : null,
      },
      metadata: this.buildFollowUpMetadata(followUp, now),
    };
  }

  private buildFollowUpMetadata(
    followUp: Pick<
      FollowUpListRecord,
      "status" | "remindAt" | "triggeredAt"
    >,
    now: Date,
  ) {
    return {
      isOverdue: this.isOverdue(followUp, now),
      isUpcomingSoon: this.isUpcomingSoon(followUp, now),
      isTriggered: followUp.triggeredAt !== null,
    };
  }

  private isOverdue(
    followUp: Pick<FollowUpListRecord, "status" | "remindAt">,
    now: Date,
  ) {
    return (
      followUp.status === PrismaFollowUpStatus.PENDING &&
      followUp.remindAt.getTime() < now.getTime()
    );
  }

  private isUpcomingSoon(
    followUp: Pick<FollowUpListRecord, "status" | "remindAt">,
    now: Date,
  ) {
    if (followUp.status !== PrismaFollowUpStatus.PENDING) {
      return false;
    }

    const remindAtMs = followUp.remindAt.getTime();
    const nowMs = now.getTime();

    return remindAtMs >= nowMs && remindAtMs <= nowMs + UPCOMING_SOON_WINDOW_MS;
  }
}

function toApiContactRequestSourceType(
  sourceType: PrismaContactRequestSourceType,
): ContactRequestSourceType {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return ContactRequestSourceType.Profile;
    case PrismaContactRequestSourceType.QR:
      return ContactRequestSourceType.Qr;
    case PrismaContactRequestSourceType.EVENT:
      return ContactRequestSourceType.Event;
  }

  throw new Error("Unsupported contact request source type");
}

function buildRelationshipSourceLabel(
  relationship: NonNullable<FollowUpListRecord["relationship"]>,
): string {
  const memory = relationship.memories[0];
  const storedContext = parseConnectionContext(relationship.connectionContext);

  return (
    normalizeContextLabel(memory?.contextLabel) ??
    normalizeContextLabel(storedContext?.label) ??
    memory?.sourceLabel ??
    toSourceLabel(relationship.sourceType)
  );
}

function toSourceLabel(sourceType: PrismaContactRequestSourceType): string {
  switch (sourceType) {
    case PrismaContactRequestSourceType.PROFILE:
      return "Profile";
    case PrismaContactRequestSourceType.QR:
      return "QR";
    case PrismaContactRequestSourceType.EVENT:
      return "Event";
  }

  throw new Error("Unsupported contact request source type");
}

function normalizeContextLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseConnectionContext(
  value: Prisma.JsonValue | null | undefined,
): { type: "profile" | "qr" | "event"; label: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const type = candidate.type;

  if (type !== "profile" && type !== "qr" && type !== "event") {
    return null;
  }

  return {
    type,
    label: normalizeContextLabel(candidate.label),
  };
}

function buildEmptyFollowUpMetadata() {
  return {
    isOverdue: false,
    isUpcomingSoon: false,
    isTriggered: false,
  };
}

function toRemindAtDate(remindAt: string) {
  const remindAtDate = new Date(remindAt);

  if (
    Number.isNaN(remindAtDate.getTime()) ||
    remindAtDate.getTime() <= Date.now()
  ) {
    throw new BadRequestException("remindAt must be a future datetime");
  }

  return remindAtDate;
}

function buildActiveRelationshipFollowUpWhere(
  now: Date,
  ownerUserId?: string,
): Prisma.FollowUpWhereInput {
  return {
    relationship: {
      is: {
        ...(ownerUserId
          ? {
              ownerUserId,
            }
          : {}),
        OR: [
          {
            state: PrismaContactRelationshipState.APPROVED,
          },
          {
            state: PrismaContactRelationshipState.INSTANT_ACCESS,
            accessEndAt: {
              gte: now,
            },
          },
        ],
      },
    },
  } satisfies Prisma.FollowUpWhereInput;
}

function toPrismaFollowUpStatus(status: FollowUpStatus): PrismaFollowUpStatus {
  switch (status) {
    case FollowUpStatus.Pending:
      return PrismaFollowUpStatus.PENDING;
    case FollowUpStatus.Completed:
      return PrismaFollowUpStatus.COMPLETED;
    case FollowUpStatus.Cancelled:
      return PrismaFollowUpStatus.CANCELLED;
  }

  throw new Error("Unsupported follow-up status");
}

function toApiFollowUpStatus(status: PrismaFollowUpStatus): FollowUpStatus {
  switch (status) {
    case PrismaFollowUpStatus.PENDING:
      return FollowUpStatus.Pending;
    case PrismaFollowUpStatus.COMPLETED:
      return FollowUpStatus.Completed;
    case PrismaFollowUpStatus.CANCELLED:
      return FollowUpStatus.Cancelled;
  }

  throw new Error("Unsupported follow-up status");
}

function toApiRelationshipState(
  state: PrismaContactRelationshipState,
): "approved" | "instant_access" | "expired" {
  switch (state) {
    case PrismaContactRelationshipState.APPROVED:
      return "approved";
    case PrismaContactRelationshipState.INSTANT_ACCESS:
      return "instant_access";
    case PrismaContactRelationshipState.EXPIRED:
      return "expired";
  }

  throw new Error("Unsupported relationship state");
}
