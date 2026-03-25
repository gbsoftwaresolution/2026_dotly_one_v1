import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../queue/queue.constants";
import type { QueueJobData } from "../queue/queue.types";

export const EXPORTS_JOB_NAMES = {
  run: "exports:run",
  cleanupExpired: "exports:cleanup-expired",
  watchdogStuck: "exports:watchdog-stuck",
} as const;

export type ExportsRunJobPayload = {
  exportId: string;
  userId: string;
};

@Injectable()
export class ExportsQueue {
  constructor(
    @InjectQueue(QUEUE_NAMES.exports) private readonly queue: Queue,
  ) {}

  async enqueueRun(args: {
    exportId: string;
    userId: string;
    requestId?: string;
  }): Promise<void> {
    const data: QueueJobData<ExportsRunJobPayload> = {
      ctx: {
        requestId: args.requestId,
        userId: args.userId,
        entityId: args.exportId,
      },
      payload: {
        exportId: args.exportId,
        userId: args.userId,
      },
    };

    // Idempotency: use exportId as BullMQ jobId.
    // Note: we keep removeOnComplete non-true so Job telemetry can still fetch recent jobs.
    try {
      await this.queue.add(EXPORTS_JOB_NAMES.run, data, {
        jobId: args.exportId,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
        removeOnComplete: 1000,
        removeOnFail: 10_000,
      });
    } catch (err: any) {
      // BullMQ throws when a job with the same jobId already exists.
      const message = String(err?.message || "");
      const name = String(err?.name || "");
      if (
        name === "JobAlreadyExistsError" ||
        message.toLowerCase().includes("already exists")
      ) {
        return;
      }
      throw err;
    }
  }

  async ensureCleanupExpiredRepeatable(args: {
    everyMs: number;
  }): Promise<void> {
    await this.queue.add(
      EXPORTS_JOB_NAMES.cleanupExpired,
      { ctx: { entityId: "exports" }, payload: {} },
      {
        jobId: EXPORTS_JOB_NAMES.cleanupExpired,
        repeat: { every: args.everyMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async ensureWatchdogStuckRepeatable(args: {
    everyMs: number;
  }): Promise<void> {
    await this.queue.add(
      EXPORTS_JOB_NAMES.watchdogStuck,
      { ctx: { entityId: "exports" }, payload: {} },
      {
        jobId: EXPORTS_JOB_NAMES.watchdogStuck,
        repeat: { every: args.everyMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
