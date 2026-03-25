import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QueueBackoffService } from "../queue/queue-backoff.service";
import { ExportsQueue } from "./exports.queue";

@Injectable()
export class ExportsSchedulerService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly exportsQueue: ExportsQueue,
    private readonly queueBackoff: QueueBackoffService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Avoid scheduling repeatable jobs during unit tests.
    if (this.configService.nodeEnv === "test") {
      return;
    }

    // Schedule cleanup for expired exports.
    const everyMs =
      this.configService.exportCleanupIntervalHours * 60 * 60 * 1000;
    this.queueBackoff.runWithBackoff({
      label: "exports:cleanup-expired",
      fn: async () =>
        this.exportsQueue.ensureCleanupExpiredRepeatable({ everyMs }),
    });
    this.logger
      .child({ component: "exports-scheduler", everyMs })
      .log("Ensuring repeatable export cleanup job (retries if Redis down)");

    // Schedule watchdog for stuck RUNNING exports.
    const watchdogEveryMs =
      this.configService.exportWatchdogIntervalMinutes * 60 * 1000;
    this.queueBackoff.runWithBackoff({
      label: "exports:watchdog-stuck",
      fn: async () =>
        this.exportsQueue.ensureWatchdogStuckRepeatable({
          everyMs: watchdogEveryMs,
        }),
    });
    this.logger
      .child({ component: "exports-scheduler", everyMs: watchdogEveryMs })
      .log(
        "Ensuring repeatable export stuck-watchdog job (retries if Redis down)",
      );
  }
}
