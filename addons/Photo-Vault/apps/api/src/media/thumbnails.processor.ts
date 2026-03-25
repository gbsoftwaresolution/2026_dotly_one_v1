import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QUEUE_NAMES } from "../queue/queue.constants";
import type { QueueJobData } from "../queue/queue.types";
import { withTimeout } from "../queue/queue.utils";
import {
  THUMBNAILS_JOB_NAMES,
  ThumbnailsQueue,
  type ThumbnailsVerifyJobPayload,
} from "./thumbnails.queue";

const THUMBNAILS_CONCURRENCY = parseInt(
  process.env.QUEUE_CONCURRENCY_THUMBNAILS || "5",
  10,
);

const THUMBNAILS_SCAN_TIMEOUT_MS = parseInt(
  process.env.QUEUE_TIMEOUT_THUMBNAILS_SCAN_MS || "60000",
  10,
);

const THUMBNAILS_VERIFY_TIMEOUT_MS = parseInt(
  process.env.QUEUE_TIMEOUT_THUMBNAILS_VERIFY_MS || "60000",
  10,
);

@Processor(QUEUE_NAMES.thumbnails, { concurrency: THUMBNAILS_CONCURRENCY })
@Injectable()
export class ThumbnailsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly thumbnailsQueue: ThumbnailsQueue,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext({ service: ThumbnailsProcessor.name });
  }

  async process(job: Job): Promise<any> {
    const startedAt = Date.now();
    const data = job.data as QueueJobData<any>;

    const log = this.logger.child({
      queue: QUEUE_NAMES.thumbnails,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      requestId: data?.ctx?.requestId,
      userId: data?.ctx?.userId,
      entityId: data?.ctx?.entityId,
    });

    try {
      if (job.name === THUMBNAILS_JOB_NAMES.scanPending) {
        await withTimeout({
          label: THUMBNAILS_JOB_NAMES.scanPending,
          timeoutMs: THUMBNAILS_SCAN_TIMEOUT_MS,
          promise: this.scanAndEnqueuePending(log),
        });
        return { ok: true };
      }

      if (job.name === THUMBNAILS_JOB_NAMES.verify) {
        await withTimeout({
          label: THUMBNAILS_JOB_NAMES.verify,
          timeoutMs: THUMBNAILS_VERIFY_TIMEOUT_MS,
          promise: this.verifySingleThumbnail(
            job.data as QueueJobData<ThumbnailsVerifyJobPayload>,
            log,
          ),
        });
        return { ok: true };
      }

      log.warn(`Unknown thumbnails job name: ${job.name}`);
      return { ok: false, reason: "unknown_job" };
    } finally {
      log.debug(
        { durationMs: Date.now() - startedAt },
        "Thumbnails job finished",
      );
    }
  }

  private async scanAndEnqueuePending(log: LoggerService): Promise<void> {
    const take = this.configService.thumbnailVerifyScanBatchSize;

    const pending = await this.prisma.media.findMany({
      where: {
        // thumbObjectKey exists but we haven't confirmed upload yet
        thumbObjectKey: { not: null },
        thumbUploadedAt: null,
      },
      orderBy: { updatedAt: "asc" },
      take,
      select: { id: true, userId: true },
    });

    if (pending.length === 0) {
      return;
    }

    log.log(
      `Found ${pending.length} media with pending thumbnail verification`,
    );

    for (const item of pending) {
      await this.thumbnailsQueue.enqueueVerify({
        mediaId: item.id,
        userId: item.userId,
      });
    }
  }

  private async verifySingleThumbnail(
    data: QueueJobData<ThumbnailsVerifyJobPayload>,
    log: LoggerService,
  ): Promise<void> {
    const mediaId = data?.payload?.mediaId;
    if (!mediaId) {
      return;
    }

    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    // Idempotency: already deleted
    if (!media) {
      return;
    }

    // No thumbnail tracked
    if (!media.thumbObjectKey) {
      return;
    }

    // Already verified
    if (media.thumbUploadedAt) {
      return;
    }

    // HEAD check
    const exists = await this.storageService.objectExists(media.thumbObjectKey);
    if (!exists) {
      return;
    }

    try {
      await this.prisma.media.update({
        where: { id: mediaId },
        data: {
          thumbUploadedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      // Idempotency: if deleted between read/update.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return;
      }
      throw err;
    }

    log.log(`Verified thumbnail exists for media ${mediaId}`);
  }
}
