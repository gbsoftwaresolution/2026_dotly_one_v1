import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../../logger/logger.service";
import { QueueBackoffService } from "../../queue/queue-backoff.service";
import { LifeDocsRemindersQueue } from "./life-docs-reminders.queue";

@Injectable()
export class LifeDocsRemindersSchedulerService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly queue: LifeDocsRemindersQueue,
    private readonly backoff: QueueBackoffService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext({ service: LifeDocsRemindersSchedulerService.name });
  }

  async onModuleInit(): Promise<void> {
    // Avoid scheduling repeatable jobs during unit tests.
    if (this.config.nodeEnv === "test") {
      return;
    }

    const everyMs = this.config.lifeDocsReminderScanIntervalHours * 60 * 60_000;

    this.backoff.runWithBackoff({
      label: "life-docs:scan-reminders",
      fn: async () => this.queue.ensureScanDueRepeatable({ everyMs }),
    });

    this.logger.log(
      `Ensuring life-docs reminder scan job every ${this.config.lifeDocsReminderScanIntervalHours} hours (retries if Redis down)`,
    );
  }
}
