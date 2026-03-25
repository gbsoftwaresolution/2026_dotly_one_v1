import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { LoggerService } from "../../logger/logger.service";
import { QUEUE_NAMES } from "../../queue/queue.constants";
import { safeJobAttempt } from "../../queue/queue.utils";
import type { QueueJobData } from "../../queue/queue.types";
import { LIFE_DOCS_REMINDERS_JOB_NAMES } from "./life-docs-reminders.queue";
import { LifeDocsRemindersService } from "./life-docs-reminders.service";

const CONCURRENCY = parseInt(
  process.env.QUEUE_CONCURRENCY_LIFE_DOCS_REMINDERS || "1",
  10,
);

@Processor(QUEUE_NAMES.lifeDocsReminders, { concurrency: CONCURRENCY })
export class LifeDocsRemindersProcessor extends WorkerHost {
  constructor(
    private readonly reminders: LifeDocsRemindersService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const startedAt = Date.now();
    const data = job.data as QueueJobData;
    const ctx = data?.ctx ?? {};

    const log = this.logger.child({
      component: "life-docs-reminders-processor",
      queue: QUEUE_NAMES.lifeDocsReminders,
      jobId: job.id,
      jobName: job.name,
      attempt: safeJobAttempt(job),
      requestId: ctx.requestId,
      userId: ctx.userId,
      entityId: ctx.entityId,
    });

    log.log("Job started");

    try {
      if (job.name === LIFE_DOCS_REMINDERS_JOB_NAMES.scanDue) {
        const result = await this.reminders.scanAndEmitDueReminders();
        return result;
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
