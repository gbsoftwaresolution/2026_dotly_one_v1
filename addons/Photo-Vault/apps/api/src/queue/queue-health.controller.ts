import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { RedisService } from "./redis.service";
import { QUEUE_NAMES } from "./queue.constants";
import { LoggerService } from "../logger/logger.service";
import type { Request as ExpressRequest } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

type QueueHealth = {
  ok: boolean;
  counts?: Record<string, number>;
  repeatables?: Array<{
    name: string;
    id?: string;
    every?: number;
    cron?: string;
    next?: number;
  }>;
  error?: string;
};

@Controller("queue")
@UseGuards(JwtAuthGuard)
export class QueueHealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @InjectQueue(QUEUE_NAMES.exports) private readonly exportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.purge) private readonly purgeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.thumbnails)
    private readonly thumbnailsQueue: Queue,
  ) {}

  @Get("health")
  @HttpCode(HttpStatus.OK)
  async getHealth(@Request() req: ExpressRequest): Promise<{
    ok: boolean;
    requestId: string | null;
    redis: { ok: boolean; latencyMs?: number; error?: string };
    workers: {
      ok: boolean;
      staleAfterSeconds: number;
      instances: Array<{
        kind: string;
        instanceId: string;
        startedAt: string;
        lastSeenAt: string;
        isStale: boolean;
      }>;
      error?: string;
    };
    queues: {
      exports: QueueHealth;
      purge: QueueHealth;
      thumbnails: QueueHealth;
    };
  }> {
    const requestId = ((req as any).requestId as string | undefined) ?? null;
    const log = this.logger.child({ component: "queue-health", requestId });

    const redisHealth: {
      ok: boolean;
      latencyMs?: number;
      error?: string;
    } = { ok: false };

    const started = Date.now();
    try {
      await this.redis.client.ping();
      redisHealth.ok = true;
      redisHealth.latencyMs = Date.now() - started;
    } catch (err: any) {
      redisHealth.ok = false;
      redisHealth.error = err?.message ?? String(err);
    }

    const [exportsHealth, purgeHealth, thumbnailsHealth] = await Promise.all([
      this.inspectQueue(this.exportsQueue),
      this.inspectQueue(this.purgeQueue),
      this.inspectQueue(this.thumbnailsQueue),
    ]);

    const workersHealth = await this.inspectWorkers();

    const ok =
      redisHealth.ok &&
      exportsHealth.ok &&
      purgeHealth.ok &&
      thumbnailsHealth.ok &&
      workersHealth.ok;

    log.log(
      {
        ok,
        redisOk: redisHealth.ok,
        workersOk: workersHealth.ok,
        exportsOk: exportsHealth.ok,
        purgeOk: purgeHealth.ok,
        thumbnailsOk: thumbnailsHealth.ok,
      },
      "Queue health checked",
    );

    return {
      ok,
      requestId,
      redis: redisHealth,
      workers: workersHealth,
      queues: {
        exports: exportsHealth,
        purge: purgeHealth,
        thumbnails: thumbnailsHealth,
      },
    };
  }

  private async inspectWorkers(): Promise<{
    ok: boolean;
    staleAfterSeconds: number;
    instances: Array<{
      kind: string;
      instanceId: string;
      startedAt: string;
      lastSeenAt: string;
      isStale: boolean;
    }>;
    error?: string;
  }> {
    const staleAfterSeconds = this.configService.workerHeartbeatStaleSeconds;
    const staleBefore = new Date(Date.now() - staleAfterSeconds * 1000);

    try {
      const rows = await this.prisma.workerHeartbeat.findMany({
        where: { kind: "bullmq" },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      });

      const instances = rows.map((r) => ({
        kind: r.kind,
        instanceId: r.instanceId,
        startedAt: r.startedAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        isStale: r.lastSeenAt < staleBefore,
      }));

      const ok = instances.some((i) => !i.isStale);

      return { ok, staleAfterSeconds, instances };
    } catch (err: any) {
      // DB may be down in development; don't throw from health endpoint.
      return {
        ok: false,
        staleAfterSeconds,
        instances: [],
        error: err?.message ?? String(err),
      };
    }
  }

  private async inspectQueue(queue: Queue): Promise<QueueHealth> {
    try {
      const counts = await queue.getJobCounts();
      const repeatablesRaw: any[] = await (queue as any).getRepeatableJobs?.(
        0,
        -1,
        true,
      );
      const repeatables = Array.isArray(repeatablesRaw)
        ? repeatablesRaw.map((r: any) => ({
            name: String(r?.name ?? ""),
            id: r?.id ? String(r.id) : undefined,
            every:
              typeof r?.every === "number" && Number.isFinite(r.every)
                ? r.every
                : undefined,
            cron: r?.cron ? String(r.cron) : undefined,
            next:
              typeof r?.next === "number" && Number.isFinite(r.next)
                ? r.next
                : undefined,
          }))
        : undefined;

      return { ok: true, counts, repeatables };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  }
}
