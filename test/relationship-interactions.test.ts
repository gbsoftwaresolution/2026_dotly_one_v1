import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { FollowUpStatus as PrismaFollowUpStatus } from "../src/generated/prisma/client";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { CreateRelationshipInteractionDto } from "../src/modules/relationships/dto/create-relationship-interaction.dto";
import { RelationshipInteractionType } from "../src/modules/relationships/relationship-interaction-type.enum";
import { RelationshipsService } from "../src/modules/relationships/relationships.service";

describe("CreateRelationshipInteractionDto", () => {
  it("accepts predefined interaction types", () => {
    const dto = plainToInstance(CreateRelationshipInteractionDto, {
      type: RelationshipInteractionType.GREETING,
    });

    assert.deepEqual(validateSync(dto), []);
  });

  it("rejects unknown interaction types", () => {
    const dto = plainToInstance(CreateRelationshipInteractionDto, {
      type: "MESSAGE",
    });

    const errors = validateSync(dto);

    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.property, "type");
  });
});

describe("RelationshipsService interactions", () => {
  it("logs an interaction, mirrors it to the reciprocal relationship, and updates metadata", async () => {
    const queryResults = [
      [
        {
          id: "relationship-id",
          ownerUserId: "owner-user",
          targetUserId: "target-user",
          ownerPersonaId: "owner-persona-id",
          targetPersonaId: "target-persona-id",
          state: "APPROVED",
          accessEndAt: null,
        },
      ],
      [{ count: 0 }],
      [{ id: "reciprocal-relationship-id" }],
    ];
    const queryStatements: unknown[] = [];
    const executedStatements: unknown[] = [];
    const metadataUpdates: string[] = [];

    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            $queryRaw: async (statement: unknown) => {
              queryStatements.push(statement);
              return queryResults.shift() ?? [];
            },
            $executeRaw: async (statement: unknown) => {
              executedStatements.push(statement);
              return 1;
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
    );

    (service as any).updateInteractionMetadata = async (
      _tx: unknown,
      relationshipId: string,
    ) => {
      metadataUpdates.push(relationshipId);
      return null;
    };

    const result = await service.createInteraction("owner-user", "relationship-id", {
      type: RelationshipInteractionType.GREETING,
    });

    assert.deepEqual(result, { success: true });
    assert.equal(executedStatements.length, 2);
    assert.deepEqual(metadataUpdates, [
      "relationship-id",
      "reciprocal-relationship-id",
    ]);

    const reciprocalLookup = queryStatements[2] as {
      strings?: string[];
      values?: unknown[];
    };

    assert.equal(
      reciprocalLookup.strings?.join(" ").includes('"ownerPersonaId"'),
      true,
    );
    assert.equal(
      reciprocalLookup.values?.includes("target-persona-id"),
      true,
    );
    assert.equal(
      reciprocalLookup.values?.includes("owner-persona-id"),
      true,
    );
  });

  it("returns the same not found for missing and foreign relationships", async () => {
    const createService = (row: unknown) =>
      new RelationshipsService(
        {
          $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
            callback({
              $queryRaw: async () => (row ? [row] : []),
            }),
        } as any,
        {
          assertNoInteractionBlockInTransaction: async () => undefined,
        } as any,
      );

    await assert.rejects(
      createService(null).createInteraction("owner-user", "relationship-id", {
        type: RelationshipInteractionType.THANK_YOU,
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );

    await assert.rejects(
      createService({
        id: "relationship-id",
        ownerUserId: "another-user",
        targetUserId: "target-user",
        ownerPersonaId: "owner-persona-id",
        targetPersonaId: "target-persona-id",
        state: "APPROVED",
        accessEndAt: null,
      }).createInteraction("owner-user", "relationship-id", {
        type: RelationshipInteractionType.THANK_YOU,
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );
  });

  it("blocks expired relationships from receiving interactions", async () => {
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            $queryRaw: async () => [
              {
                id: "relationship-id",
                ownerUserId: "owner-user",
                targetUserId: "target-user",
                ownerPersonaId: "owner-persona-id",
                targetPersonaId: "target-persona-id",
                state: "EXPIRED",
                accessEndAt: new Date("2026-03-24T09:00:00.000Z"),
              },
            ],
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.createInteraction("owner-user", "relationship-id", {
        type: RelationshipInteractionType.FOLLOW_UP,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(
          error.message,
          "Expired relationships cannot receive interactions",
        );
        return true;
      },
    );
  });

  it("applies a basic per-relationship interaction cooldown", async () => {
    let queryCount = 0;
    const service = new RelationshipsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            $queryRaw: async () => {
              queryCount += 1;

              if (queryCount === 1) {
                return [
                  {
                    id: "relationship-id",
                    ownerUserId: "owner-user",
                    targetUserId: "target-user",
                    ownerPersonaId: "owner-persona-id",
                    targetPersonaId: "target-persona-id",
                    state: "APPROVED",
                    accessEndAt: null,
                  },
                ];
              }

              return [{ count: 5 }];
            },
          }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.createInteraction("owner-user", "relationship-id", {
        type: RelationshipInteractionType.GREETING,
      }),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        assert.equal(
          error.message,
          "Too many interactions right now. Please wait before sending another signal.",
        );
        return true;
      },
    );
  });

  it("returns recent interactions through the helper", async () => {
    const expectedRows = [
      {
        id: "interaction-1",
        relationshipId: "relationship-id",
        senderUserId: "owner-user",
        type: RelationshipInteractionType.GREETING,
        payload: null,
        createdAt: new Date("2026-03-24T18:00:00.000Z"),
      },
    ];
    const service = new RelationshipsService({
      $queryRaw: async () => expectedRows,
    } as any);

    const result = await service.getRecentInteractions("relationship-id", 99);

    assert.deepEqual(result, expectedRows);
  });

  it("builds a unified relationship activity timeline sorted newest first", async () => {
    const service = new RelationshipsService({
      contactRelationship: {
        findFirst: async () => ({
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
          connectedAt: new Date("2026-03-21T09:00:00.000Z"),
        }),
      },
      followUp: {
        findMany: async () => [
          {
            id: "follow-up-1",
            createdAt: new Date("2026-03-24T08:00:00.000Z"),
            completedAt: new Date("2026-03-24T11:30:00.000Z"),
            status: PrismaFollowUpStatus.COMPLETED,
          },
          {
            id: "follow-up-2",
            createdAt: new Date("2026-03-24T07:00:00.000Z"),
            completedAt: null,
            status: PrismaFollowUpStatus.PENDING,
          },
        ],
      },
      $queryRaw: async () => [
        {
          id: "interaction-1",
          relationshipId: "relationship-id",
          senderUserId: "owner-user",
          type: RelationshipInteractionType.THANK_YOU,
          payload: null,
          createdAt: new Date("2026-03-24T12:00:00.000Z"),
        },
        {
          id: "interaction-2",
          relationshipId: "relationship-id",
          senderUserId: "owner-user",
          type: RelationshipInteractionType.FOLLOW_UP,
          payload: null,
          createdAt: new Date("2026-03-24T09:30:00.000Z"),
        },
        {
          id: "interaction-3",
          relationshipId: "relationship-id",
          senderUserId: "owner-user",
          type: RelationshipInteractionType.GREETING,
          payload: null,
          createdAt: new Date("2026-03-22T09:00:00.000Z"),
        },
      ],
    } as any);

    const result = await service.getRelationshipActivityTimeline(
      "owner-user",
      "relationship-id",
    );

    assert.deepEqual(
      result.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
      [
        {
          id: "interaction-interaction-1",
          type: "INTERACTION",
          label: "You sent thanks",
          timestamp: "2026-03-24T12:00:00.000Z",
        },
        {
          id: "follow-up-completed-follow-up-1",
          type: "FOLLOW_UP_COMPLETED",
          label: "Completed a follow-up",
          timestamp: "2026-03-24T11:30:00.000Z",
        },
        {
          id: "interaction-interaction-2",
          type: "INTERACTION",
          label: "You followed up",
          timestamp: "2026-03-24T09:30:00.000Z",
        },
        {
          id: "follow-up-created-follow-up-1",
          type: "FOLLOW_UP_CREATED",
          label: "Set a reminder",
          timestamp: "2026-03-24T08:00:00.000Z",
        },
        {
          id: "follow-up-created-follow-up-2",
          type: "FOLLOW_UP_CREATED",
          label: "Set a reminder",
          timestamp: "2026-03-24T07:00:00.000Z",
        },
        {
          id: "interaction-interaction-3",
          type: "INTERACTION",
          label: "You said hi",
          timestamp: "2026-03-22T09:00:00.000Z",
        },
        {
          id: "connected-relationship-id",
          type: "CONNECTED",
          label: "Connected",
          timestamp: "2026-03-21T09:00:00.000Z",
        },
      ],
    );
  });

  it("keeps distinct aggregated timeline events even when labels and timestamps match", async () => {
    const duplicatedTimestamp = new Date("2026-03-24T08:00:00.000Z");
    const service = new RelationshipsService({
      contactRelationship: {
        findFirst: async () => ({
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
          connectedAt: new Date("2026-03-21T09:00:00.000Z"),
        }),
      },
      followUp: {
        findMany: async () => [
          {
            id: "follow-up-1",
            createdAt: duplicatedTimestamp,
            completedAt: null,
            status: PrismaFollowUpStatus.PENDING,
          },
          {
            id: "follow-up-2",
            createdAt: duplicatedTimestamp,
            completedAt: null,
            status: PrismaFollowUpStatus.PENDING,
          },
        ],
      },
      $queryRaw: async () => [],
    } as any);

    const result = await service.getRelationshipActivityTimeline(
      "owner-user",
      "relationship-id",
    );

    assert.equal(
      result.filter(
        (event) =>
          event.type === "FOLLOW_UP_CREATED" &&
          event.timestamp.toISOString() === duplicatedTimestamp.toISOString(),
      ).length,
      2,
    );
    assert.deepEqual(
      result
        .filter(
          (event) =>
            event.type === "FOLLOW_UP_CREATED" &&
            event.timestamp.toISOString() === duplicatedTimestamp.toISOString(),
        )
        .map((event) => event.id)
        .sort(),
      [
        "follow-up-created-follow-up-1",
        "follow-up-created-follow-up-2",
      ],
    );
  });

  it("labels received interaction events from the other side clearly", async () => {
    const service = new RelationshipsService({
      contactRelationship: {
        findFirst: async () => ({
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
          connectedAt: new Date("2026-03-21T09:00:00.000Z"),
        }),
      },
      followUp: {
        findMany: async () => [],
      },
      $queryRaw: async () => [
        {
          id: "interaction-1",
          relationshipId: "relationship-id",
          senderUserId: "other-user",
          type: RelationshipInteractionType.GREETING,
          payload: null,
          createdAt: new Date("2026-03-24T12:00:00.000Z"),
        },
      ],
    } as any);

    const result = await service.getRelationshipActivityTimeline(
      "owner-user",
      "relationship-id",
    );

    assert.equal(result[0]?.label, "They said hi");
  });

  it("returns the same not found for missing and foreign activity timeline lookups", async () => {
    const createService = (findFirst: (args: {
      where: { id: string; ownerUserId: string };
    }) => Promise<unknown>) =>
      new RelationshipsService({
        contactRelationship: {
          findFirst,
        },
        followUp: {
          findMany: async () => [],
        },
        $queryRaw: async () => [],
      } as any);

    await assert.rejects(
      createService(async () => null).getRelationshipActivityTimeline(
        "owner-user",
        "relationship-id",
      ),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );

    await assert.rejects(
      createService(async ({ where }) => {
        assert.equal(where.id, "relationship-id");
        assert.equal(where.ownerUserId, "owner-user");

        return null;
      }).getRelationshipActivityTimeline("owner-user", "relationship-id"),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Relationship not found");
        return true;
      },
    );
  });
});