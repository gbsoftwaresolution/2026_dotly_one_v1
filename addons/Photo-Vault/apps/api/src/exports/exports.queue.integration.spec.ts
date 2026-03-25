import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

import { Queue, Worker, QueueEvents } from "bullmq";
import type { Job } from "bullmq";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { ExportsQueue } from "./exports.queue";
import { ExportsProcessor } from "./exports.processor";
import { ExportsService } from "./exports.service";
import { QUEUE_NAMES } from "../queue/queue.constants";
import { ExportStatus } from "@booster-vault/shared";

function makeMockLogger() {
  return {
    child: jest.fn().mockReturnThis(),
    setContext: jest.fn(),
    getContext: jest.fn().mockReturnValue({}),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };
}

describe("Exports queue integration (Redis via testcontainers)", () => {
  let redisUrl: string | null = null;
  let container: StartedTestContainer | null = null;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("redis:7-alpine")
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
        .start();

      const host = container.getHost();
      const port = container.getMappedPort(6379);
      redisUrl = `redis://${host}:${port}`;
    } catch (err: unknown) {
      // If Docker isn't available, keep suite passing but skip the actual integration coverage.
      // eslint-disable-next-line no-console
      console.warn(
        "Skipping Redis integration test (testcontainers not available):",
        err instanceof Error ? err.message : String(err),
      );
      redisUrl = null;
    }
  }, 60_000);

  afterAll(async () => {
    if (container) {
      await container.stop();
      container = null;
    }
  });

  it("enqueues an export job and transitions QUEUED -> READY (storage mocked)", async () => {
    if (!redisUrl) {
      return;
    }

    const connection = { url: redisUrl } as any;

    const exportRecord: any = {
      id: "exp-1",
      userId: "user-1",
      status: ExportStatus.QUEUED,
      updatedAt: new Date(Date.now() - 60_000),
      createdAt: new Date(Date.now() - 120_000),
      scopeType: "VAULT",
      scopeAlbumId: null,
      scopeFrom: null,
      scopeTo: null,
      outputObjectKey: null,
      outputByteSize: null,
      readyAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      errorMessage: null,
    };

    const mockPrisma: any = {
      export: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.id === exportRecord.id) return { ...exportRecord };
          return null;
        }),
        updateMany: jest
          .fn()
          .mockImplementation(async ({ where, data }: any) => {
            if (where?.id !== exportRecord.id) return { count: 0 };
            const allowed = [
              ExportStatus.QUEUED,
              ExportStatus.FAILED,
              ExportStatus.RUNNING,
            ];
            if (!allowed.includes(exportRecord.status)) return { count: 0 };
            exportRecord.status = data.status;
            exportRecord.updatedAt = data.updatedAt;
            exportRecord.errorMessage = data.errorMessage;
            exportRecord.outputObjectKey = data.outputObjectKey;
            exportRecord.outputByteSize = data.outputByteSize;
            exportRecord.readyAt = data.readyAt;
            return { count: 1 };
          }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          if (where?.id !== exportRecord.id) throw new Error("not found");
          Object.assign(exportRecord, data);
          return { ...exportRecord };
        }),
      },
    };

    const mockConfig: any = {
      exportTtlDays: 7,
      exportMaxActiveJobsPerUser: 2,
      exportDownloadUrlTtlSeconds: 900,
      exportWorkerStuckThresholdMinutes: 10,
      exportDownloadTimeout: 30,
    };

    const mockStorage: any = {
      putObjectStream: jest.fn(),
      deleteObject: jest.fn(),
      createSignedDownloadUrl: jest.fn(),
      createSignedUploadUrl: jest.fn(),
      getObjectStream: jest.fn(),
      objectExists: jest.fn(),
    };

    const queue = new Queue(QUEUE_NAMES.exports, { connection });
    const queueEvents = new QueueEvents(QUEUE_NAMES.exports, { connection });

    // Ensure a clean queue for deterministic test behavior.
    await queue.obliterate({ force: true });

    const exportsQueue = new ExportsQueue(queue as any);
    const exportsService = new ExportsService(
      mockConfig,
      mockPrisma,
      mockStorage,
      makeMockLogger() as any,
      exportsQueue as any,
    );

    // Keep integration focused: avoid zip creation + storage work.
    jest
      .spyOn(exportsService as any, "getExportMediaItems")
      .mockResolvedValue([]);
    jest
      .spyOn(exportsService as any, "generateManifest")
      .mockResolvedValue({ v: 1, items: [] });
    jest
      .spyOn(exportsService as any, "createExportZip")
      .mockResolvedValue(1234);

    const processor = new ExportsProcessor(
      exportsService as any,
      makeMockLogger() as any,
    );

    const worker = new Worker(
      QUEUE_NAMES.exports,
      async (job: Job) => processor.process(job),
      { connection, concurrency: 1 },
    );

    try {
      await exportsQueue.enqueueRun({
        exportId: exportRecord.id,
        userId: exportRecord.userId,
        requestId: "req-1",
      });

      const job = await queue.getJob(exportRecord.id);
      expect(job).toBeTruthy();

      await (job as any).waitUntilFinished(queueEvents, 10_000);

      expect(exportRecord.status).toBe(ExportStatus.READY);
      expect(exportRecord.outputObjectKey).toBe(
        `u/${exportRecord.userId}/exports/${exportRecord.id}.zip`,
      );
      expect(exportRecord.outputByteSize).toBe(1234);
      expect(exportRecord.readyAt).toBeInstanceOf(Date);
    } finally {
      await worker.close();
      await queueEvents.close();
      await queue.close();
    }
  }, 20_000);
});
