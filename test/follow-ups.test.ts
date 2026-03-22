import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  FollowUpStatus as PrismaFollowUpStatus,
} from "@prisma/client";

import { FollowUpsService } from "../src/modules/follow-ups/follow-ups.service";

function createFollowUpRecord(overrides: Record<string, unknown> = {}) {
  const baseRemindAt = new Date("2099-04-10T10:00:00.000Z");
  const baseUpdatedAt = new Date("2099-04-01T12:00:00.000Z");

  return {
    id: "follow-up-1",
    ownerUserId: "user-1",
    relationshipId: "relationship-1",
    remindAt: baseRemindAt,
    triggeredAt: null,
    status: PrismaFollowUpStatus.PENDING,
    note: "Follow up on partnership discussion",
    createdAt: new Date("2099-04-01T09:00:00.000Z"),
    updatedAt: baseUpdatedAt,
    completedAt: null,
    relationship: {
      id: "relationship-1",
      ownerUserId: "user-1",
      state: PrismaContactRelationshipState.APPROVED,
      sourceType: PrismaContactRequestSourceType.EVENT,
      connectionContext: { type: "event", label: "Tech Summit" },
      accessEndAt: null,
      memories: [
        {
          contextLabel: "Tech Summit",
          sourceLabel: "Event",
        },
      ],
      targetPersona: {
        id: "persona-1",
        username: "alice",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        profilePhotoUrl: null,
      },
    },
    ...overrides,
  };
}

const noopRelationshipExpiryService = {
  expireOwnedExpiredRelationships: async () => undefined,
  expireExpiredRelationships: async () => undefined,
};

describe("FollowUpsService", () => {
  it("creates a follow-up for an owned active relationship", async () => {
    let createPayload: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => ({
                id: "relationship-1",
                ownerUserId: "user-1",
                state: PrismaContactRelationshipState.APPROVED,
                accessEndAt: null,
              }),
            },
            followUp: {
              create: async (args: Record<string, unknown>) => {
                createPayload = args;
                return createFollowUpRecord();
              },
            },
          }),
      } as any,
      {
        expireRelationshipIfNeeded: async (_tx: unknown, relationship: unknown) =>
          relationship,
      } as any,
    );

    const result = await service.createFollowUp("user-1", {
      relationshipId: "relationship-1",
      remindAt: "2099-04-10T10:00:00.000Z",
      note: "Follow up on partnership discussion",
    });

    assert.equal((createPayload as any)?.data.ownerUserId, "user-1");
    assert.equal((createPayload as any)?.data.relationshipId, "relationship-1");
    assert.equal(result.id, "follow-up-1");
    assert.equal(result.status, "pending");
    assert.equal(result.relationship.state, "approved");
    assert.equal(result.relationship.sourceType, "event");
    assert.equal(result.relationship.sourceLabel, "Tech Summit");
    assert.ok(result.relationship.targetPersona);
    assert.equal(result.relationship.targetPersona.username, "alice");
  });

  it("rejects follow-up creation for a relationship owned by another user", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => ({
                id: "relationship-1",
                ownerUserId: "user-2",
                state: PrismaContactRelationshipState.APPROVED,
                accessEndAt: null,
              }),
            },
          }),
      } as any,
      {
        expireRelationshipIfNeeded: async (_tx: unknown, relationship: unknown) =>
          relationship,
      } as any,
    );

    await assert.rejects(
      service.createFollowUp("user-1", {
        relationshipId: "relationship-1",
        remindAt: "2099-04-10T10:00:00.000Z",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "You are not allowed to create follow-ups for this relationship",
        );
        return true;
      },
    );
  });

  it("rejects follow-up creation when the relationship does not exist", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => null,
            },
          }),
      } as any,
      {
        expireRelationshipIfNeeded: async (_tx: unknown, relationship: unknown) =>
          relationship,
      } as any,
    );

    await assert.rejects(
      service.createFollowUp("user-1", {
        relationshipId: "relationship-1",
        remindAt: "2099-04-10T10:00:00.000Z",
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );
  });

  it("rejects follow-up creation for expired relationships", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRelationship: {
              findUnique: async () => ({
                id: "relationship-1",
                ownerUserId: "user-1",
                state: PrismaContactRelationshipState.APPROVED,
                accessEndAt: new Date("2026-03-01T10:00:00.000Z"),
              }),
            },
          }),
      } as any,
      {
        expireRelationshipIfNeeded: async () => ({
          id: "relationship-1",
          ownerUserId: "user-1",
          state: PrismaContactRelationshipState.EXPIRED,
          accessEndAt: new Date("2026-03-01T10:00:00.000Z"),
        }),
      } as any,
    );

    await assert.rejects(
      service.createFollowUp("user-1", {
        relationshipId: "relationship-1",
        remindAt: "2099-04-10T10:00:00.000Z",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Relationship is no longer active");
        return true;
      },
    );
  });

  it("lists only the current user's pending follow-ups in remindAt order for upcoming queries", async () => {
    let findManyArgs: Record<string, unknown> | null = null;
    const expireCalls: string[] = [];

    const service = new FollowUpsService(
      {
        followUp: {
          findMany: async (args: Record<string, unknown>) => {
            findManyArgs = args;
            return [
              createFollowUpRecord({
                id: "pending-later",
                remindAt: new Date("2099-04-12T10:00:00.000Z"),
              }),
              createFollowUpRecord({
                id: "pending-sooner",
                remindAt: new Date("2099-04-09T10:00:00.000Z"),
              }),
            ];
          },
        },
      } as any,
      {
        expireOwnedExpiredRelationships: async (userId: string) => {
          expireCalls.push(userId);
        },
      } as any,
    );

    const result = await service.listFollowUps("user-1", {
      upcoming: true,
    });

    assert.deepEqual(expireCalls, ["user-1"]);
    assert.equal((findManyArgs as any)?.where.ownerUserId, "user-1");
    assert.equal(
      (findManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((findManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.ok((findManyArgs as any)?.where.remindAt.gte instanceof Date);
    assert.deepEqual(
      result.map((followUp) => followUp.id),
      ["pending-sooner", "pending-later"],
    );
  });

  it("lists due follow-ups in remindAt order for the current user", async () => {
    let findManyArgs: Record<string, unknown> | null = null;
    const expireCalls: string[] = [];

    const service = new FollowUpsService(
      {
        followUp: {
          findMany: async (args: Record<string, unknown>) => {
            findManyArgs = args;
            return [
              createFollowUpRecord({
                id: "due-later",
                remindAt: new Date("2026-03-22T09:00:00.000Z"),
                triggeredAt: new Date("2026-03-22T09:05:00.000Z"),
              }),
              createFollowUpRecord({
                id: "due-sooner",
                remindAt: new Date("2026-03-22T08:00:00.000Z"),
              }),
            ];
          },
        },
      } as any,
      {
        expireOwnedExpiredRelationships: async (userId: string) => {
          expireCalls.push(userId);
        },
      } as any,
    );

    const result = await service.listDueFollowUps("user-1");

    assert.deepEqual(expireCalls, ["user-1"]);
    assert.equal((findManyArgs as any)?.where.ownerUserId, "user-1");
    assert.equal(
      (findManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((findManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.ok((findManyArgs as any)?.where.remindAt.lte instanceof Date);
    assert.deepEqual(
      result.map((followUp) => followUp.id),
      ["due-sooner", "due-later"],
    );
    assert.equal(result[0]?.metadata.isTriggered, false);
    assert.equal(result[1]?.metadata.isTriggered, true);
  });

  it("marks a due pending follow-up as triggered exactly once", async () => {
    let updateManyArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        followUp: {
          updateMany: async (args: Record<string, unknown>) => {
            updateManyArgs = args;
            return { count: 1 };
          },
          findFirst: async () =>
            createFollowUpRecord({
              triggeredAt: new Date("2026-03-22T10:00:00.000Z"),
            }),
        },
      } as any,
      noopRelationshipExpiryService as any,
    );

    const result = await service.markTriggeredIfDue("user-1", "follow-up-1");

    assert.equal((updateManyArgs as any)?.where.id, "follow-up-1");
    assert.equal((updateManyArgs as any)?.where.ownerUserId, "user-1");
    assert.equal(
      (updateManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((updateManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.equal((updateManyArgs as any)?.where.triggeredAt, null);
    assert.ok((updateManyArgs as any)?.where.remindAt.lte instanceof Date);
    assert.ok((updateManyArgs as any)?.data.triggeredAt instanceof Date);
    assert.ok(result.triggeredAt instanceof Date);
    assert.equal(result.metadata.isTriggered, true);
  });

  it("returns the current state when a follow-up is already triggered", async () => {
    const triggeredAt = new Date("2026-03-22T10:00:00.000Z");

    const service = new FollowUpsService(
      {
        followUp: {
          updateMany: async () => ({ count: 0 }),
          findFirst: async () =>
            createFollowUpRecord({
              triggeredAt,
            }),
        },
      } as any,
      noopRelationshipExpiryService as any,
    );

    const result = await service.markTriggeredIfDue("user-1", "follow-up-1");

    assert.equal(result.triggeredAt?.toISOString(), triggeredAt.toISOString());
    assert.equal(result.metadata.isTriggered, true);
  });

  it("processes only untriggered due follow-ups for the current user", async () => {
    let updateManyArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        followUp: {
          updateMany: async (args: Record<string, unknown>) => {
            updateManyArgs = args;
            return { count: 2 };
          },
        },
      } as any,
      noopRelationshipExpiryService as any,
    );

    const result = await service.processDueFollowUps({
      userId: "user-1",
    });

    assert.equal((updateManyArgs as any)?.where.ownerUserId, "user-1");
    assert.equal(
      (updateManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((updateManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.equal((updateManyArgs as any)?.where.triggeredAt, null);
    assert.ok((updateManyArgs as any)?.where.remindAt.lte instanceof Date);
    assert.ok((updateManyArgs as any)?.data.triggeredAt instanceof Date);
    assert.deepEqual(result, {
      processedCount: 2,
    });
  });

  it("keeps the due cutoff in the limited processing update", async () => {
    let updateManyArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        followUp: {
          findMany: async () => [{ id: "follow-up-1" }],
          updateMany: async (args: Record<string, unknown>) => {
            updateManyArgs = args;
            return { count: 1 };
          },
        },
      } as any,
      noopRelationshipExpiryService as any,
    );

    const result = await service.processDueFollowUps({
      userId: "user-1",
      limit: 1,
    });

    assert.equal(
      (updateManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((updateManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.equal((updateManyArgs as any)?.where.triggeredAt, null);
    assert.ok((updateManyArgs as any)?.where.remindAt.lte instanceof Date);
    assert.deepEqual(result, {
      processedCount: 1,
    });
  });

  it("returns an empty result for foreign relationship filters without leaking presence", async () => {
    let findManyArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        followUp: {
          findMany: async (args: Record<string, unknown>) => {
            findManyArgs = args;
            return [];
          },
        },
      } as any,
      {
        expireOwnedExpiredRelationships: async () => undefined,
      } as any,
    );

    const result = await service.listFollowUps("user-1", {
      relationshipId: "relationship-foreign",
    } as any);

    assert.deepEqual(result, []);
    assert.equal((findManyArgs as any)?.where.ownerUserId, "user-1");
    assert.equal(
      (findManyArgs as any)?.where.relationshipId,
      "relationship-foreign",
    );
    assert.equal(
      (findManyArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
  });

  it("rejects updates for non-pending follow-ups", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () =>
                createFollowUpRecord({
                  status: PrismaFollowUpStatus.COMPLETED,
                  completedAt: new Date("2099-04-05T10:00:00.000Z"),
                }),
            },
          }),
      } as any,
      {} as any,
    );

    await assert.rejects(
      service.updateFollowUp("user-1", "follow-up-1", {
        note: "Updated note",
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Only pending follow-ups can be updated");
        return true;
      },
    );
  });

  it("returns not found for another user's follow-up", async () => {
    const service = new FollowUpsService(
      {
        followUp: {
          findFirst: async () => null,
        },
      } as any,
      {} as any,
    );

    await assert.rejects(
      service.getFollowUp("user-1", "follow-up-1"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Follow-up not found");
        return true;
      },
    );
  });

  it("completes a pending follow-up and records completion time", async () => {
    let updateArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () => createFollowUpRecord(),
              update: async (args: Record<string, unknown>) => {
                updateArgs = args;
                return createFollowUpRecord({
                  status: PrismaFollowUpStatus.COMPLETED,
                  completedAt: new Date("2099-04-05T10:00:00.000Z"),
                });
              },
            },
          }),
      } as any,
      {} as any,
    );

    const result = await service.completeFollowUp("user-1", "follow-up-1");

    assert.equal((updateArgs as any)?.data.status, PrismaFollowUpStatus.COMPLETED);
    assert.ok((updateArgs as any)?.data.completedAt instanceof Date);
    assert.equal(result.status, "completed");
    assert.ok(result.completedAt instanceof Date);
  });

  it("cancels a pending follow-up without recording completion time", async () => {
    let updateArgs: Record<string, unknown> | null = null;

    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () => createFollowUpRecord(),
              update: async (args: Record<string, unknown>) => {
                updateArgs = args;
                return createFollowUpRecord({
                  status: PrismaFollowUpStatus.CANCELLED,
                  completedAt: null,
                });
              },
            },
          }),
      } as any,
      {} as any,
    );

    const result = await service.cancelFollowUp("user-1", "follow-up-1");

    assert.equal((updateArgs as any)?.data.status, PrismaFollowUpStatus.CANCELLED);
    assert.equal((updateArgs as any)?.data.completedAt, null);
    assert.equal(result.status, "cancelled");
    assert.equal(result.completedAt, null);
  });

  it("rejects repeated complete transitions", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () =>
                createFollowUpRecord({
                  status: PrismaFollowUpStatus.COMPLETED,
                  completedAt: new Date("2099-04-05T10:00:00.000Z"),
                }),
            },
          }),
      } as any,
      {} as any,
    );

    await assert.rejects(
      service.completeFollowUp("user-1", "follow-up-1"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Only pending follow-ups can be completed");
        return true;
      },
    );
  });

  it("rejects repeated cancel transitions", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () =>
                createFollowUpRecord({
                  status: PrismaFollowUpStatus.CANCELLED,
                }),
            },
          }),
      } as any,
      {} as any,
    );

    await assert.rejects(
      service.cancelFollowUp("user-1", "follow-up-1"),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "Only pending follow-ups can be cancelled");
        return true;
      },
    );
  });

  it("rejects past remindAt values during update", async () => {
    const service = new FollowUpsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            followUp: {
              findUnique: async () => createFollowUpRecord(),
            },
          }),
      } as any,
      {} as any,
    );

    await assert.rejects(
      service.updateFollowUp("user-1", "follow-up-1", {
        remindAt: "2000-01-01T00:00:00.000Z",
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "remindAt must be a future datetime");
        return true;
      },
    );
  });

  it("returns a sanitized relationship summary", async () => {
    const service = new FollowUpsService(
      {
        followUp: {
          findUnique: async () => createFollowUpRecord(),
        },
      } as any,
      {} as any,
    );

    const result = await service.getFollowUp("user-1", "follow-up-1");

    assert.equal(result.relationshipId, "relationship-1");
    assert.ok(result.updatedAt instanceof Date);
    assert.deepEqual(Object.keys(result.relationship).sort(), [
      "relationshipId",
      "sourceLabel",
      "sourceType",
      "state",
      "targetPersona",
    ]);
    assert.ok(result.relationship.targetPersona);
    assert.deepEqual(Object.keys(result.relationship.targetPersona).sort(), [
      "companyName",
      "fullName",
      "id",
      "jobTitle",
      "profilePhotoUrl",
      "username",
    ]);
    assert.deepEqual(Object.keys(result.metadata).sort(), [
      "isOverdue",
      "isTriggered",
      "isUpcomingSoon",
    ]);
  });

  it("returns metadata flags and degrades safely when relationship data is missing", async () => {
    const service = new FollowUpsService(
      {
        followUp: {
          findUnique: async () =>
            createFollowUpRecord({
              remindAt: new Date(Date.now() - 60 * 1000),
              relationship: null,
            }),
        },
      } as any,
      {} as any,
    );

    const result = await service.getFollowUp("user-1", "follow-up-1");

    assert.equal(result.relationship.relationshipId, "relationship-1");
    assert.equal(result.relationship.state, null);
    assert.equal(result.relationship.targetPersona, null);
    assert.equal(result.metadata.isOverdue, true);
    assert.equal(result.metadata.isTriggered, false);
    assert.equal(result.metadata.isUpcomingSoon, false);
  });

  it("returns pending follow-up summary for a relationship", async () => {
    let aggregateArgs: Record<string, unknown> | null = null;
    let findFirstArgs: Record<string, unknown> | null = null;
    const triggeredAt = new Date("2099-04-09T10:05:00.000Z");

    const service = new FollowUpsService(
      {
        followUp: {
          aggregate: async (args: Record<string, unknown>) => {
            aggregateArgs = args;

            return {
              _count: {
                id: 2,
              },
              _min: {
                remindAt: new Date("2099-04-09T10:00:00.000Z"),
              },
            };
          },
          findFirst: async (args: Record<string, unknown>) => {
            findFirstArgs = args;

            return {
              remindAt: new Date("2099-04-09T10:00:00.000Z"),
              triggeredAt,
              status: PrismaFollowUpStatus.PENDING,
            };
          },
        },
      } as any,
      noopRelationshipExpiryService as any,
    );

    const result = await service.getFollowUpSummaryForRelationship(
      "user-1",
      "relationship-1",
    );

    assert.equal((aggregateArgs as any)?.where.ownerUserId, "user-1");
    assert.equal((aggregateArgs as any)?.where.relationshipId, "relationship-1");
    assert.equal(
      (aggregateArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((aggregateArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.equal((findFirstArgs as any)?.where.ownerUserId, "user-1");
    assert.equal((findFirstArgs as any)?.where.relationshipId, "relationship-1");
    assert.equal(
      (findFirstArgs as any)?.where.relationship.is.ownerUserId,
      "user-1",
    );
    assert.equal((findFirstArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.equal(result.hasPendingFollowUp, true);
    assert.equal(result.pendingFollowUpCount, 2);
    assert.equal(
      result.nextFollowUpAt?.toISOString(),
      "2099-04-09T10:00:00.000Z",
    );
    assert.equal(result.isTriggered, true);
    assert.equal(result.isOverdue, false);
    assert.equal(result.isUpcomingSoon, false);
  });
});