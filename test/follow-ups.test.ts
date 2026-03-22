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
    status: PrismaFollowUpStatus.PENDING,
    note: "Follow up on partnership discussion",
    createdAt: new Date("2099-04-01T09:00:00.000Z"),
    updatedAt: baseUpdatedAt,
    completedAt: null,
    relationship: {
      id: "relationship-1",
      ownerUserId: "user-1",
      state: PrismaContactRelationshipState.APPROVED,
      accessEndAt: null,
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
    assert.equal((findManyArgs as any)?.where.status, PrismaFollowUpStatus.PENDING);
    assert.ok((findManyArgs as any)?.where.remindAt.gte instanceof Date);
    assert.deepEqual(
      result.map((followUp) => followUp.id),
      ["pending-sooner", "pending-later"],
    );
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
    assert.deepEqual((findManyArgs as any)?.where, {
      ownerUserId: "user-1",
      relationshipId: "relationship-foreign",
    });
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
    assert.equal(result.metadata.isUpcomingSoon, false);
  });

  it("returns pending follow-up summary for a relationship", async () => {
    let aggregateArgs: Record<string, unknown> | null = null;

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
        },
      } as any,
      {} as any,
    );

    const result = await service.getFollowUpSummaryForRelationship(
      "user-1",
      "relationship-1",
    );

    assert.deepEqual((aggregateArgs as any)?.where, {
      ownerUserId: "user-1",
      relationshipId: "relationship-1",
      status: PrismaFollowUpStatus.PENDING,
    });
    assert.equal(result.hasPendingFollowUp, true);
    assert.equal(result.pendingFollowUpCount, 2);
    assert.equal(
      result.nextFollowUpAt?.toISOString(),
      "2099-04-09T10:00:00.000Z",
    );
  });
});