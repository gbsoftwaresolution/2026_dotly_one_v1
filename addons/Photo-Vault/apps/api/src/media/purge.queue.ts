import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../queue/queue.constants";
import type { QueueJobData } from "../queue/queue.types";

export const PURGE_JOB_NAMES = {
  scanDue: "purge:scan-due",
  media: "purge:media",
} as const;

export type PurgeMediaJobPayload = {
  mediaId: string;
  userId?: string;
};

@Injectable()
export class PurgeQueue {
  constructor(@InjectQueue(QUEUE_NAMES.purge) private readonly queue: Queue) {}

  async ensureScanDueRepeatable(args: { everyMs: number }): Promise<void> {
    await this.queue.add(
      PURGE_JOB_NAMES.scanDue,
      { ctx: { entityId: "purge" }, payload: {} },
      {
        jobId: PURGE_JOB_NAMES.scanDue,
        repeat: { every: args.everyMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async enqueueMediaPurge(args: {
    mediaId: string;
    userId?: string;
    requestId?: string;
  }): Promise<void> {
    const data: QueueJobData<PurgeMediaJobPayload> = {
      ctx: {
        requestId: args.requestId,
        userId: args.userId,
        entityId: args.mediaId,
      },
      payload: {
        mediaId: args.mediaId,
        userId: args.userId,
      },
    };

    try {
      // Idempotency: use mediaId as BullMQ jobId.
      await this.queue.add(PURGE_JOB_NAMES.media, data, {
        jobId: args.mediaId,
        attempts: 8,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
        removeOnComplete: 10_000,
        removeOnFail: 50_000,
      });
    } catch (err: any) {
      // BullMQ throws when a job with the same jobId already exists.
      // The scan job may re-discover a due media item while it is still queued/processing.
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
}
