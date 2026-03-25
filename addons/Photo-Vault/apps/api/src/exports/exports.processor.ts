import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { LoggerService } from "../logger/logger.service";
import { QUEUE_NAMES } from "../queue/queue.constants";
import { safeJobAttempt, withTimeout } from "../queue/queue.utils";
import type { QueueJobData } from "../queue/queue.types";
import { ExportsService } from "./exports.service";
import { EXPORTS_JOB_NAMES, type ExportsRunJobPayload } from "./exports.queue";

const EXPORTS_CONCURRENCY = parseInt(
  process.env.QUEUE_CONCURRENCY_EXPORTS || "2",
  10,
);

const EXPORTS_RUN_TIMEOUT_MS = parseInt(
  process.env.QUEUE_TIMEOUT_EXPORTS_MS || "360000",
  10,
);

@Processor(QUEUE_NAMES.exports, { concurrency: EXPORTS_CONCURRENCY })
export class ExportsProcessor extends WorkerHost {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const startedAt = Date.now();
    const data = job.data as QueueJobData;
    const ctx = data?.ctx ?? {};

    const log = this.logger.child({
      component: "exports-processor",
      queue: QUEUE_NAMES.exports,
      jobId: job.id,
      jobName: job.name,
      attempt: safeJobAttempt(job),
      requestId: ctx.requestId,
      userId: ctx.userId,
      entityId: ctx.entityId,
    });

    log.log("Job started");

    try {
      if (job.name === EXPORTS_JOB_NAMES.run) {
        const payload = (data?.payload ?? {}) as ExportsRunJobPayload;
        await withTimeout({
          label: EXPORTS_JOB_NAMES.run,
          timeoutMs: EXPORTS_RUN_TIMEOUT_MS,
          promise: this.exportsService.processExportJobQueued({
            exportId: payload.exportId,
            userId: payload.userId,
            requestId: ctx.requestId,
            attempt: safeJobAttempt(job),
          }),
        });
        return { ok: true };
      }

      if (job.name === EXPORTS_JOB_NAMES.cleanupExpired) {
        const cleaned = await this.exportsService.cleanupExpiredExports();
        return { cleaned };
      }

      if (job.name === EXPORTS_JOB_NAMES.watchdogStuck) {
        const cleaned = await this.exportsService.cleanupStuckExports();
        return { cleaned };
      }

      log.warn({ jobName: job.name }, "Unknown job name");
      return { ignored: true };
    } catch (err: unknown) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "Job error",
      );
      throw err;
    } finally {
      log.log({ durationMs: Date.now() - startedAt }, "Job finished");
    }
  }
}
