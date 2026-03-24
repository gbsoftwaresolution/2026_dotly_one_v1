import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { FollowUpReminderLifecycleService } from "../src/modules/follow-ups/follow-up-reminder-lifecycle.service";

describe("FollowUpReminderLifecycleService", () => {
  it("processes due follow-ups in bounded batches", async () => {
    let processArgs: Record<string, unknown> | null = null;
    const logCalls: Array<Record<string, unknown>> = [];

    const service = new FollowUpReminderLifecycleService(
      {
        processDueFollowUps: async (args: Record<string, unknown>) => {
          processArgs = args;
          return {
            processedCount: 4,
          };
        },
      } as any,
      {
        get: (key: string, fallback?: unknown) => {
          switch (key) {
            case "followUps.processing.enabled":
              return true;
            case "followUps.processing.batchSize":
              return 25;
            default:
              return fallback;
          }
        },
      } as any,
      {
        logWithMeta: (
          _level: string,
          message: string,
          metadata: Record<string, unknown>,
        ) => {
          logCalls.push({ message, metadata });
        },
      } as any,
    );

    const result = await service.processDueFollowUps({
      trigger: "test",
    });

    assert.deepEqual(processArgs, {
      limit: 25,
    });
    assert.deepEqual(result, {
      processedCount: 4,
      batchSize: 25,
      trigger: "test",
      skipped: false,
    });
    assert.equal(logCalls[0]?.message, "Follow-up reminder processing completed");
    assert.equal(
      (logCalls[0]?.metadata as Record<string, unknown> | undefined)?.processedCount,
      4,
    );
  });

  it("skips scheduled processing when disabled", async () => {
    let processCalled = false;

    const service = new FollowUpReminderLifecycleService(
      {
        processDueFollowUps: async () => {
          processCalled = true;
          return {
            processedCount: 1,
          };
        },
      } as any,
      {
        get: (key: string, fallback?: unknown) => {
          switch (key) {
            case "followUps.processing.enabled":
              return false;
            case "followUps.processing.batchSize":
              return 10;
            default:
              return fallback;
          }
        },
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
    );

    const result = await service.processDueFollowUps({
      trigger: "scheduled",
    });

    assert.equal(processCalled, false);
    assert.deepEqual(result, {
      processedCount: 0,
      batchSize: 10,
      trigger: "scheduled",
      skipped: true,
    });
  });

  it("logs and rethrows processing failures", async () => {
    const errorCalls: Array<Record<string, unknown>> = [];
    const expectedError = new Error("database unavailable");

    const service = new FollowUpReminderLifecycleService(
      {
        processDueFollowUps: async () => {
          throw expectedError;
        },
      } as any,
      {
        get: (key: string, fallback?: unknown) => {
          switch (key) {
            case "followUps.processing.enabled":
              return true;
            case "followUps.processing.batchSize":
              return 5;
            default:
              return fallback;
          }
        },
      } as any,
      {
        errorWithMeta: (
          message: string,
          metadata: Record<string, unknown>,
        ) => {
          errorCalls.push({ message, metadata });
        },
      } as any,
    );

    await assert.rejects(
      service.processDueFollowUps({
        trigger: "test",
      }),
      (error: unknown) => {
        assert.equal(error, expectedError);
        return true;
      },
    );

    assert.equal(errorCalls[0]?.message, "Follow-up reminder processing failed");
    assert.equal(
      (errorCalls[0]?.metadata as Record<string, unknown> | undefined)?.message,
      "database unavailable",
    );
  });

  it("generates passive follow-ups in bounded batches", async () => {
    let generationArgs: Array<unknown> | null = null;
    const logCalls: Array<Record<string, unknown>> = [];

    const service = new FollowUpReminderLifecycleService(
      {
        processDueFollowUps: async () => ({ processedCount: 0 }),
        generatePassiveFollowUps: async (...args: Array<unknown>) => {
          generationArgs = args;
          return {
            generatedCount: 3,
            evaluatedRelationshipCount: 7,
          };
        },
      } as any,
      {
        get: (key: string, fallback?: unknown) => {
          switch (key) {
            case "followUps.passiveProcessing.enabled":
              return true;
            case "followUps.passiveProcessing.batchSize":
              return 12;
            default:
              return fallback;
          }
        },
      } as any,
      {
        logWithMeta: (
          _level: string,
          message: string,
          metadata: Record<string, unknown>,
        ) => {
          logCalls.push({ message, metadata });
        },
      } as any,
    );

    const result = await service.processPassiveFollowUps({
      trigger: "test",
    });

    assert.deepEqual(generationArgs, [undefined, { limit: 12 }]);
    assert.deepEqual(result, {
      generatedCount: 3,
      evaluatedRelationshipCount: 7,
      batchSize: 12,
      trigger: "test",
      skipped: false,
    });
    assert.equal(logCalls[0]?.message, "Passive follow-up generation completed");
    assert.equal(
      (logCalls[0]?.metadata as Record<string, unknown> | undefined)
        ?.generatedCount,
      3,
    );
  });

  it("skips passive generation when disabled", async () => {
    let generationCalled = false;

    const service = new FollowUpReminderLifecycleService(
      {
        processDueFollowUps: async () => ({ processedCount: 0 }),
        generatePassiveFollowUps: async () => {
          generationCalled = true;
          return {
            generatedCount: 1,
            evaluatedRelationshipCount: 1,
          };
        },
      } as any,
      {
        get: (key: string, fallback?: unknown) => {
          switch (key) {
            case "followUps.passiveProcessing.enabled":
              return false;
            case "followUps.passiveProcessing.batchSize":
              return 9;
            default:
              return fallback;
          }
        },
      } as any,
      {
        logWithMeta: () => undefined,
      } as any,
    );

    const result = await service.processPassiveFollowUps({
      trigger: "scheduled",
    });

    assert.equal(generationCalled, false);
    assert.deepEqual(result, {
      generatedCount: 0,
      evaluatedRelationshipCount: 0,
      batchSize: 9,
      trigger: "scheduled",
      skipped: true,
    });
  });
});