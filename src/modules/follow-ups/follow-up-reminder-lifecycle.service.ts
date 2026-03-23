import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { AppLoggerService } from "../../infrastructure/logging/logging.service";

import { FollowUpsService } from "./follow-ups.service";

export type FollowUpReminderProcessingSummary = {
  processedCount: number;
  batchSize: number;
  trigger: "scheduled" | "manual" | "test";
  skipped: boolean;
};

@Injectable()
export class FollowUpReminderLifecycleService {
  static readonly jobName = "follow-up-reminder-processing";
  private static readonly context = "FollowUpReminderLifecycleService";

  constructor(
    private readonly followUpsService: FollowUpsService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  @Cron(process.env.FOLLOW_UPS_PROCESSING_CRON ?? CronExpression.EVERY_MINUTE, {
    name: FollowUpReminderLifecycleService.jobName,
    disabled: process.env.FOLLOW_UPS_PROCESSING_ENABLED === "false",
  })
  async processScheduledDueFollowUps() {
    await this.processDueFollowUps({
      trigger: "scheduled",
    });
  }

  async processDueFollowUps(options?: {
    trigger?: "scheduled" | "manual" | "test";
    batchSize?: number;
    enabled?: boolean;
  }): Promise<FollowUpReminderProcessingSummary> {
    const trigger = options?.trigger ?? "manual";
    const enabled = options?.enabled ?? this.isEnabled();
    const batchSize = this.resolveBatchSize(options?.batchSize);

    if (!enabled) {
      this.logger.logWithMeta(
        "log",
        "Follow-up reminder processing skipped",
        {
          trigger,
          batchSize,
          enabled,
        },
        FollowUpReminderLifecycleService.context,
      );

      return {
        processedCount: 0,
        batchSize,
        trigger,
        skipped: true,
      };
    }

    try {
      const result = await this.followUpsService.processDueFollowUps({
        limit: batchSize,
      });

      this.logger.logWithMeta(
        "log",
        "Follow-up reminder processing completed",
        {
          trigger,
          batchSize,
          processedCount: result.processedCount,
        },
        FollowUpReminderLifecycleService.context,
      );

      return {
        processedCount: result.processedCount,
        batchSize,
        trigger,
        skipped: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const trace = error instanceof Error ? error.stack : undefined;

      this.logger.errorWithMeta(
        "Follow-up reminder processing failed",
        {
          trigger,
          batchSize,
          message,
        },
        trace,
        FollowUpReminderLifecycleService.context,
      );

      throw error;
    }
  }

  private isEnabled(): boolean {
    return this.configService.get<boolean>("followUps.processing.enabled", true);
  }

  private resolveBatchSize(batchSize?: number): number {
    const configuredBatchSize =
      batchSize ??
      this.configService.get<number>("followUps.processing.batchSize", 100);

    if (
      typeof configuredBatchSize !== "number" ||
      !Number.isFinite(configuredBatchSize) ||
      configuredBatchSize < 1
    ) {
      return 100;
    }

    return Math.floor(configuredBatchSize);
  }
}