import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
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
});