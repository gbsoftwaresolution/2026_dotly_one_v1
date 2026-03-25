import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../../queue/queue.constants";

export const LIFE_DOCS_REMINDERS_JOB_NAMES = {
  scanDue: "life-docs:scan-reminders",
} as const;

@Injectable()
export class LifeDocsRemindersQueue {
  constructor(
    @InjectQueue(QUEUE_NAMES.lifeDocsReminders) private readonly queue: Queue,
  ) {}

  async ensureScanDueRepeatable(args: { everyMs: number }): Promise<void> {
    await this.queue.add(
      LIFE_DOCS_REMINDERS_JOB_NAMES.scanDue,
      { ctx: { entityId: "life-docs" }, payload: {} },
      {
        jobId: LIFE_DOCS_REMINDERS_JOB_NAMES.scanDue,
        repeat: { every: args.everyMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
