import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  FollowUpStatus as PrismaFollowUpStatus,
  Prisma,
} from "@prisma/client";

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

const followUpSelect = {
  id: true,
  ownerUserId: true,
  relationshipId: true,
  remindAt: true,
  status: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  relationship: {
    select: {
      id: true,
      ownerUserId: true,
      state: true,
      accessEndAt: true,
      targetPersona: {
        select: followUpTargetPersonaSelect,
      },
    },
  },
} satisfies Prisma.FollowUpSelect;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type FollowUpRecord = Prisma.FollowUpGetPayload<{
  select: typeof followUpSelect;
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
        select: followUpSelect,
      });

      return this.toFollowUpView(createdFollowUp);
    });
  }

  async listFollowUps(userId: string, query: ListFollowUpsQueryDto) {
    await this.relationshipsService.expireOwnedExpiredRelationships(userId);

    const now = new Date();
    const followUps = await this.prismaService.followUp.findMany({
      where: {
        ownerUserId: userId,
        ...(query.status
          ? {
              status: toPrismaFollowUpStatus(query.status),
            }
          : {}),
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
      },
      select: followUpSelect,
    });

    return followUps
      .sort(compareFollowUps)
      .map((followUp) => this.toFollowUpView(followUp, now));
  }

  async getFollowUp(userId: string, id: string) {
    const followUp = await this.getOwnedFollowUp(this.prismaService, userId, id);
    return this.toFollowUpView(followUp);
  }

  async getFollowUpSummaryForRelationship(userId: string, relationshipId: string) {
    const aggregate = await this.prismaService.followUp.aggregate({
      where: {
        ownerUserId: userId,
        relationshipId,
        status: PrismaFollowUpStatus.PENDING,
      },
      _count: {
        id: true,
      },
      _min: {
        remindAt: true,
      },
    });

    const pendingFollowUpCount = aggregate._count.id;

    return {
      hasPendingFollowUp: pendingFollowUpCount > 0,
      nextFollowUpAt: aggregate._min.remindAt ?? null,
      pendingFollowUpCount,
    };
  }

  async updateFollowUp(userId: string, id: string, dto: UpdateFollowUpDto) {
    return this.prismaService.$transaction(async (tx) => {
      const followUp = await this.getOwnedFollowUp(tx, userId, id);
      this.assertPending(followUp, "Only pending follow-ups can be updated");

      const data: Prisma.FollowUpUpdateInput = {};

      if (dto.remindAt !== undefined) {
        data.remindAt = toRemindAtDate(dto.remindAt);
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
        select: followUpSelect,
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
      const followUp = await this.getOwnedFollowUp(tx, userId, id);
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
        select: followUpSelect,
      });

      return this.toFollowUpView(updatedFollowUp);
    });
  }

  private async getOwnedRelationshipForCreate(
    prisma: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const relationship = await prisma.contactRelationship.findUnique({
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

    if (!relationship) {
      throw new NotFoundException("Relationship not found");
    }

    if (relationship.ownerUserId !== userId) {
      throw new ForbiddenException(
        "You are not allowed to create follow-ups for this relationship",
      );
    }

    const normalizedRelationship =
      await this.relationshipsService.expireRelationshipIfNeeded(
        prisma,
        relationship,
      );

    if (normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED) {
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
        select: typeof followUpSelect;
      }) => Promise<FollowUpRecord | null>;
      findUnique?: (args: {
        where: { id: string };
        select: typeof followUpSelect;
      }) => Promise<FollowUpRecord | null>;
    };

    const followUp =
      typeof followUpDelegate.findFirst === "function"
        ? await followUpDelegate.findFirst({
            where: {
              id,
              ownerUserId: userId,
            },
            select: followUpSelect,
          })
        : await followUpDelegate.findUnique?.({
            where: {
              id,
            },
            select: followUpSelect,
          });

    if (!followUp || followUp.ownerUserId !== userId) {
      throw new NotFoundException("Follow-up not found");
    }

    return followUp;
  }

  private assertPending(followUp: FollowUpRecord, message: string) {
    if (followUp.status !== PrismaFollowUpStatus.PENDING) {
      throw new ConflictException(message);
    }
  }

  private toFollowUpView(followUp: FollowUpRecord, now = new Date()) {
    const relationship = followUp.relationship;

    return {
      id: followUp.id,
      relationshipId: followUp.relationshipId,
      remindAt: followUp.remindAt,
      status: toApiFollowUpStatus(followUp.status),
      note: followUp.note,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
      completedAt: followUp.completedAt,
      relationship: {
        relationshipId: relationship?.id ?? followUp.relationshipId,
        state: relationship ? toApiRelationshipState(relationship.state) : null,
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

  private buildFollowUpMetadata(followUp: FollowUpRecord, now: Date) {
    return {
      isOverdue: this.isOverdue(followUp, now),
      isUpcomingSoon: this.isUpcomingSoon(followUp, now),
    };
  }

  private isOverdue(followUp: Pick<FollowUpRecord, "status" | "remindAt">, now: Date) {
    return (
      followUp.status === PrismaFollowUpStatus.PENDING &&
      followUp.remindAt.getTime() < now.getTime()
    );
  }

  private isUpcomingSoon(
    followUp: Pick<FollowUpRecord, "status" | "remindAt">,
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

function compareFollowUps(a: FollowUpRecord, b: FollowUpRecord) {
  const aIsPending = a.status === PrismaFollowUpStatus.PENDING;
  const bIsPending = b.status === PrismaFollowUpStatus.PENDING;

  if (aIsPending && !bIsPending) {
    return -1;
  }

  if (!aIsPending && bIsPending) {
    return 1;
  }

  if (aIsPending && bIsPending) {
    const remindAtDelta = a.remindAt.getTime() - b.remindAt.getTime();

    if (remindAtDelta !== 0) {
      return remindAtDelta;
    }

    const createdAtDelta = a.createdAt.getTime() - b.createdAt.getTime();

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return a.id.localeCompare(b.id);
  }

  const resolvedAtDelta = getResolvedFollowUpSortTime(b) - getResolvedFollowUpSortTime(a);

  if (resolvedAtDelta !== 0) {
    return resolvedAtDelta;
  }

  const updatedAtDelta = b.updatedAt.getTime() - a.updatedAt.getTime();

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  const createdAtDelta = b.createdAt.getTime() - a.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return a.id.localeCompare(b.id);
}

function getResolvedFollowUpSortTime(followUp: FollowUpRecord) {
  return (followUp.completedAt ?? followUp.updatedAt).getTime();
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