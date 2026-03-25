import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QueueBackoffService } from "../queue/queue-backoff.service";
import { PurgeQueue } from "./purge.queue";

@Injectable()
export class PurgeSchedulerService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly purgeQueue: PurgeQueue,
    private readonly queueBackoff: QueueBackoffService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext({ service: PurgeSchedulerService.name });
  }

  async onModuleInit(): Promise<void> {
    // Avoid scheduling repeatable jobs during unit tests.
    if (this.configService.nodeEnv === "test") {
      return;
    }

    const everyMs = this.configService.purgeScanIntervalMinutes * 60_000;

    this.queueBackoff.runWithBackoff({
      label: "purge:scan-due",
      fn: async () => this.purgeQueue.ensureScanDueRepeatable({ everyMs }),
    });

    this.logger.log(
      `Ensuring purge scan job every ${this.configService.purgeScanIntervalMinutes} minutes (retries if Redis down)`,
    );
  }
}
