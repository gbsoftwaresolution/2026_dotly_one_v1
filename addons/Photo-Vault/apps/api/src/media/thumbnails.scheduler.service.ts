import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QueueBackoffService } from "../queue/queue-backoff.service";
import { ThumbnailsQueue } from "./thumbnails.queue";

@Injectable()
export class ThumbnailsSchedulerService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly thumbnailsQueue: ThumbnailsQueue,
    private readonly queueBackoff: QueueBackoffService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext({ service: ThumbnailsSchedulerService.name });
  }

  async onModuleInit(): Promise<void> {
    // Avoid scheduling repeatable jobs during unit tests.
    if (this.configService.nodeEnv === "test") {
      return;
    }

    const everyMs =
      this.configService.thumbnailVerifyScanIntervalMinutes * 60_000;
    this.queueBackoff.runWithBackoff({
      label: "thumbnails:scan-pending",
      fn: async () =>
        this.thumbnailsQueue.ensureScanPendingRepeatable({ everyMs }),
    });

    this.logger.log(
      `Ensuring thumbnails scan job every ${this.configService.thumbnailVerifyScanIntervalMinutes} minutes (retries if Redis down)`,
    );
  }
}
