import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import {
  RELATIONSHIP_NOTES_MAX_LENGTH,
  UpdateRelationshipDto,
} from "../src/modules/relationships/dto/update-relationship.dto";
import { RelationshipsService } from "../src/modules/relationships/relationships.service";

async function captureNotFound(action: () => Promise<unknown>) {
  try {
    await action();
    assert.fail("Expected NotFoundException");
  } catch (error) {
    assert.ok(error instanceof NotFoundException);

    return {
      message: error.message,
      status: error.getStatus(),
    };
  }
}

describe("UpdateRelationshipDto", () => {
  it("normalizes plain-text notes input", () => {
    const dto = plainToInstance(UpdateRelationshipDto, {
      notes: "  Met at demo day\r\nFollow up next week\u0000  ",
    });

    assert.equal(dto.notes, "Met at demo day\nFollow up next week");
    assert.deepEqual(validateSync(dto), []);
  });

  it("treats empty notes as null", () => {
    const dto = plainToInstance(UpdateRelationshipDto, {
      notes: "  \u0000\n  ",
    });

    assert.equal(dto.notes, null);
    assert.deepEqual(validateSync(dto), []);
  });

  it("rejects notes that exceed the limit", () => {
    const dto = plainToInstance(UpdateRelationshipDto, {
      notes: "a".repeat(RELATIONSHIP_NOTES_MAX_LENGTH + 1),
    });

    const errors = validateSync(dto);

    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.property, "notes");
  });
});

describe("RelationshipsService relationship notes", () => {
  it("updates owned relationship notes and returns the latest timestamp", async () => {
    const initialUpdatedAt = new Date("2026-03-24T17:00:00.000Z");
    const nextUpdatedAt = new Date("2026-03-24T17:05:00.000Z");
    let queryCount = 0;

    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          $queryRaw: async () => {
            queryCount += 1;

            if (queryCount === 1) {
              return [
                {
                  id: "relationship-id",
                  ownerUserId: "owner-user",
                  notes: null,
                  updatedAt: initialUpdatedAt,
                },
              ];
            }

            return [
              {
                id: "relationship-id",
                notes: "Met at demo day\nFollow up next week",
                updatedAt: nextUpdatedAt,
              },
            ];
          },
        }),
    } as any);

    const result = await service.updateOwnedRelationshipNotes(
      "owner-user",
      "relationship-id",
      {
        notes: "Met at demo day\nFollow up next week",
      },
    );

    assert.equal(queryCount, 2);
    assert.deepEqual(result, {
      id: "relationship-id",
      notes: "Met at demo day\nFollow up next week",
      updatedAt: nextUpdatedAt,
    });
  });

  it("does not update metadata when notes are unchanged", async () => {
    const updatedAt = new Date("2026-03-24T17:00:00.000Z");
    let queryCount = 0;

    const service = new RelationshipsService({
      $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
        callback({
          $queryRaw: async () => {
            queryCount += 1;

            return [
              {
                id: "relationship-id",
                ownerUserId: "owner-user",
                notes: "Existing note",
                updatedAt,
              },
            ];
          },
        }),
    } as any);

    const result = await service.updateOwnedRelationshipNotes(
      "owner-user",
      "relationship-id",
      {
        notes: "Existing note",
      },
    );

    assert.equal(queryCount, 1);
    assert.deepEqual(result, {
      id: "relationship-id",
      notes: "Existing note",
      updatedAt,
    });
  });

  it("returns the same not found for missing and foreign relationships", async () => {
    const createService = (row: unknown) =>
      new RelationshipsService({
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            $queryRaw: async () => (row ? [row] : []),
          }),
      } as any);

    const missing = await captureNotFound(() =>
      createService(null).updateOwnedRelationshipNotes(
        "owner-user",
        "relationship-id",
        { notes: "Private note" },
      ),
    );
    const foreign = await captureNotFound(() =>
      createService({
        id: "relationship-id",
        ownerUserId: "another-user",
        notes: null,
        updatedAt: new Date("2026-03-24T17:00:00.000Z"),
      }).updateOwnedRelationshipNotes("owner-user", "relationship-id", {
        notes: "Private note",
      }),
    );

    assert.deepEqual(foreign, missing);
  });
});