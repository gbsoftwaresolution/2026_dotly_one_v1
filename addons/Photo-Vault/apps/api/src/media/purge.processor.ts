import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { LoggerService } from "../logger/logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { QUEUE_NAMES } from "../queue/queue.constants";
import type { QueueJobData } from "../queue/queue.types";
import { ConfigService } from "../config/config.service";
import { withTimeout } from "../queue/queue.utils";
import {
  PURGE_JOB_NAMES,
  PurgeQueue,
  type PurgeMediaJobPayload,
} from "./purge.queue";

const PURGE_CONCURRENCY = parseInt(
  process.env.QUEUE_CONCURRENCY_PURGE || "5",
  10,
);

const PURGE_SCAN_TIMEOUT_MS = parseInt(
  process.env.QUEUE_TIMEOUT_PURGE_SCAN_MS || "60000",
  10,
);

const PURGE_MEDIA_TIMEOUT_MS = parseInt(
  process.env.QUEUE_TIMEOUT_PURGE_MEDIA_MS || "120000",
  10,
);

function isNotFoundLikeStorageError(error: any): boolean {
  const name = String(error?.name || "");
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const httpStatus = error?.$metadata?.httpStatusCode;

  return (
    code === "ENOENT" ||
    name === "NotFound" ||
    name === "NoSuchKey" ||
    httpStatus === 404 ||
    message.toLowerCase().includes("not found")
  );
}

@Processor(QUEUE_NAMES.purge, { concurrency: PURGE_CONCURRENCY })
@Injectable()
export class PurgeProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly purgeQueue: PurgeQueue,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    super();
    this.logger.setContext({ service: PurgeProcessor.name });
  }

  async process(job: Job): Promise<any> {
    const startedAt = Date.now();
    const data = job.data as QueueJobData<any>;

    const log = this.logger.child({
      queue: QUEUE_NAMES.purge,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      requestId: data?.ctx?.requestId,
      userId: data?.ctx?.userId,
      entityId: data?.ctx?.entityId,
    });

    try {
      if (job.name === PURGE_JOB_NAMES.scanDue) {
        await withTimeout({
          label: PURGE_JOB_NAMES.scanDue,
          timeoutMs: PURGE_SCAN_TIMEOUT_MS,
          promise: this.scanAndEnqueueDueMedia(log),
        });
        return { ok: true };
      }

      if (job.name === PURGE_JOB_NAMES.media) {
        await withTimeout({
          label: PURGE_JOB_NAMES.media,
          timeoutMs: PURGE_MEDIA_TIMEOUT_MS,
          promise: this.purgeSingleMedia(
            job.data as QueueJobData<PurgeMediaJobPayload>,
            log,
          ),
        });
        return { ok: true };
      }

      log.warn(`Unknown purge job name: ${job.name}`);
      return { ok: false, reason: "unknown_job" };
    } finally {
      log.debug({ durationMs: Date.now() - startedAt }, "Purge job finished");
    }
  }

  private async scanAndEnqueueDueMedia(log: LoggerService): Promise<void> {
    const now = new Date();
    const take = this.configService.purgeScanBatchSize;

    const due = await this.prisma.media.findMany({
      where: {
        isTrashed: true,
        purgeAfter: { not: null, lte: now },
      },
      orderBy: { purgeAfter: "asc" },
      take,
      select: { id: true, userId: true },
    });

    if (due.length === 0) {
      return;
    }

    log.log(`Found ${due.length} due trashed media to purge`);

    for (const item of due) {
      await this.purgeQueue.enqueueMediaPurge({
        mediaId: item.id,
        userId: item.userId,
      });
    }
  }

  private async purgeSingleMedia(
    data: QueueJobData<PurgeMediaJobPayload>,
    log: LoggerService,
  ): Promise<void> {
    const mediaId = data?.payload?.mediaId;
    if (!mediaId) {
      return;
    }

    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    // Idempotency: already deleted/purged.
    if (!media) {
      return;
    }

    // Only purge items that are trashed and due.
    if (!media.isTrashed) {
      return;
    }

    if (!media.purgeAfter) {
      return;
    }

    const now = new Date();
    if (media.purgeAfter.getTime() > now.getTime()) {
      return;
    }

    // 1) delete storage objects (ciphertext). Missing objects are treated as success.
    try {
      await this.storageService.deleteObject(media.objectKey);
    } catch (err: any) {
      if (!isNotFoundLikeStorageError(err)) {
        throw err;
      }
    }

    if (media.thumbObjectKey) {
      try {
        await this.storageService.deleteObject(media.thumbObjectKey);
      } catch (err: any) {
        if (!isNotFoundLikeStorageError(err)) {
          throw err;
        }
      }
    }

    // 2-4) delete dependent DB rows (if required) + delete media row.
    // AlbumItem rows cascade on media delete; we still need to clear album cover references.
    await this.prisma.$transaction(async (tx) => {
      await tx.album.updateMany({
        where: {
          userId: media.userId,
          coverMediaId: mediaId,
        },
        data: {
          coverMediaId: null,
        },
      });

      try {
        await tx.media.delete({ where: { id: mediaId } });
      } catch (err: any) {
        // Idempotency: row already deleted by another worker/request.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          return;
        }
        throw err;
      }

      // Update usage counters
      await tx.userUsage.update({
        where: { userId: media.userId },
        data: {
          totalMediaCount: { decrement: 1 },
          trashedMediaCount: { decrement: 1 },
          ...(media.type === "PHOTO"
            ? { totalPhotoCount: { decrement: 1 } }
            : media.type === "VIDEO"
              ? { totalVideoCount: { decrement: 1 } }
              : {}),
          updatedAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          userId: media.userId,
          eventType: "MEDIA_PURGED",
          entityType: "MEDIA",
          entityId: mediaId,
          meta: { triggeredBy: "purge:scan-due" },
        },
      });
    });

    log.log(`Purged media ${mediaId}`);
  }
}
