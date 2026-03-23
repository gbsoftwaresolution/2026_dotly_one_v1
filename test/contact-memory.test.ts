import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ContactMemoryService } from "../src/modules/contact-memory/contact-memory.service";

describe("ContactMemoryService", () => {
  it("preserves the earliest meeting memory when later interactions are recorded", async () => {
    let createArgs: any = null;

    const service = new ContactMemoryService();
    const tx = {
      contactMemory: {
        findFirst: async () => ({
          id: "initial-memory-id",
        }),
        create: async (args: any) => {
          createArgs = args;
          return { id: "interaction-memory-id" };
        },
      },
    };

    const result = await service.upsertInteractionMemory(tx as any, {
      relationshipId: "relationship-id",
      eventId: "event-id",
      contextLabel: "Launch Event",
      metAt: new Date("2026-03-23T11:00:00.000Z"),
      sourceLabel: "Instant connect via Event",
    });

    assert.deepEqual(result, {
      id: "interaction-memory-id",
    });
    assert.deepEqual(createArgs, {
      data: {
        relationshipId: "relationship-id",
        eventId: "event-id",
        contextLabel: "Launch Event",
        metAt: new Date("2026-03-23T11:00:00.000Z"),
        sourceLabel: "Instant connect via Event",
      },
      select: {
        id: true,
      },
    });
  });
});
