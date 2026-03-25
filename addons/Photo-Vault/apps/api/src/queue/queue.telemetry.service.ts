import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, QueueEvents } from "bullmq";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QUEUE_NAMES } from "./queue.constants";
import { jobDurationMs, safeJobAttempt } from "./queue.utils";

@Injectable()
export class QueueTelemetryService implements OnModuleInit, OnModuleDestroy {
  private exportsEvents?: QueueEvents;
  private purgeEvents?: QueueEvents;
  private thumbnailsEvents?: QueueEvents;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @InjectQueue(QUEUE_NAMES.exports) private readonly exportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.purge) private readonly purgeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.thumbnails)
    private readonly thumbnailsQueue: Queue,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.configService.redisUrl };
    const log = this.logger.child({ component: "queue-telemetry" });

    this.exportsEvents = new QueueEvents(QUEUE_NAMES.exports, { connection });
    this.purgeEvents = new QueueEvents(QUEUE_NAMES.purge, { connection });
    this.thumbnailsEvents = new QueueEvents(QUEUE_NAMES.thumbnails, {
      connection,
    });

    this.wireQueueEvents(
      this.exportsEvents,
      this.exportsQueue,
      log.child({ queue: QUEUE_NAMES.exports }),
    );
    this.wireQueueEvents(
      this.purgeEvents,
      this.purgeQueue,
      log.child({ queue: QUEUE_NAMES.purge }),
    );
    this.wireQueueEvents(
      this.thumbnailsEvents,
      this.thumbnailsQueue,
      log.child({ queue: QUEUE_NAMES.thumbnails }),
    );

    log.log("Queue telemetry started");
  }

  private wireQueueEvents(
    events: QueueEvents,
    queue: Queue,
    log: LoggerService,
  ): void {
    events.on("completed", async ({ jobId }) => {
      const job = await queue.getJob(jobId);
      const data: any = job?.data ?? {};

      log.log(
        {
          jobId,
          jobName: job?.name,
          userId: data?.ctx?.userId,
          entityId: data?.ctx?.entityId,
          requestId: data?.ctx?.requestId,
          attempt: safeJobAttempt(job),
          durationMs: jobDurationMs(job),
        },
        "Job completed",
      );
    });

    events.on("failed", async ({ jobId, failedReason }) => {
      const job = await queue.getJob(jobId);
      const data: any = job?.data ?? {};

      log.error(
        {
          jobId,
          jobName: job?.name,
          userId: data?.ctx?.userId,
          entityId: data?.ctx?.entityId,
          requestId: data?.ctx?.requestId,
          attempt: safeJobAttempt(job),
          durationMs: jobDurationMs(job),
          failedReason,
        },
        "Job failed",
      );
    });

    events.on("error", (err) => {
      log.error({ err: err?.message ?? String(err) }, "QueueEvents error");
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [
        this.exportsEvents?.close(),
        this.purgeEvents?.close(),
        this.thumbnailsEvents?.close(),
      ].filter(Boolean) as Promise<any>[],
    );
  }
}
