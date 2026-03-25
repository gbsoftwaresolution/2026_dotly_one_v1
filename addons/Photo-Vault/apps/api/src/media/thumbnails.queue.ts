import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../queue/queue.constants";
import type { QueueJobData } from "../queue/queue.types";

export const THUMBNAILS_JOB_NAMES = {
  scanPending: "thumbnails:scan-pending",
  verify: "thumbnails:verify",
} as const;

export type ThumbnailsVerifyJobPayload = {
  mediaId: string;
  userId?: string;
};

@Injectable()
export class ThumbnailsQueue {
  constructor(
    @InjectQueue(QUEUE_NAMES.thumbnails) private readonly queue: Queue,
  ) {}

  async ensureScanPendingRepeatable(args: { everyMs: number }): Promise<void> {
    await this.queue.add(
      THUMBNAILS_JOB_NAMES.scanPending,
      { ctx: { entityId: "thumbnails" }, payload: {} },
      {
        jobId: THUMBNAILS_JOB_NAMES.scanPending,
        repeat: { every: args.everyMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async enqueueVerify(args: {
    mediaId: string;
    userId?: string;
    requestId?: string;
  }): Promise<void> {
    const data: QueueJobData<ThumbnailsVerifyJobPayload> = {
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
      // Idempotency: mediaId as jobId.
      await this.queue.add(THUMBNAILS_JOB_NAMES.verify, data, {
        jobId: args.mediaId,
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        // Verification may be re-enqueued until the thumbnail actually exists,
        // so completed jobs must be removed to allow re-adding with the same jobId.
        removeOnComplete: true,
        removeOnFail: 50_000,
      });
    } catch (err: any) {
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
