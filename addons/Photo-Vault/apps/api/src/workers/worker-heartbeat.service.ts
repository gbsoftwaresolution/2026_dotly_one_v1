import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import os from "os";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private beatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly kind = "bullmq";
  private readonly instanceId: string;
  private readonly startedAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const host = process.env.HOSTNAME || os.hostname();
    this.instanceId = `${host}-${process.pid}-${randomUUID().slice(0, 8)}`;
  }

  onModuleInit(): void {
    // Avoid noisy intervals during unit tests.
    if (this.configService.nodeEnv === "test") {
      return;
    }

    const everyMs = this.configService.workerHeartbeatIntervalSeconds * 1000;
    const log = this.logger.child({
      component: "worker-heartbeat",
      kind: this.kind,
      instanceId: this.instanceId,
      everyMs,
    });

    // Fire once on startup, then periodically.
    void this.beatOnce(log);

    this.beatInterval = setInterval(() => void this.beatOnce(log), everyMs);
    // Allow process to exit naturally (BullMQ connections keep it alive anyway).
    this.beatInterval.unref?.();

    const cleanupEveryMs =
      this.configService.workerHeartbeatCleanupIntervalMinutes * 60_000;
    void this.cleanupOnce(log);
    this.cleanupInterval = setInterval(
      () => void this.cleanupOnce(log),
      cleanupEveryMs,
    );
    this.cleanupInterval.unref?.();

    log.log("Worker heartbeat started");
  }

  async onModuleDestroy(): Promise<void> {
    if (this.beatInterval) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async beatOnce(log?: LoggerService): Promise<void> {
    const logger =
      log ??
      this.logger.child({
        component: "worker-heartbeat",
        kind: this.kind,
        instanceId: this.instanceId,
      });

    try {
      await this.prisma.workerHeartbeat.upsert({
        where: {
          kind_instanceId: {
            kind: this.kind,
            instanceId: this.instanceId,
          },
        },
        create: {
          kind: this.kind,
          instanceId: this.instanceId,
          startedAt: this.startedAt,
          lastSeenAt: new Date(),
          meta: {
            pid: process.pid,
            hostname: process.env.HOSTNAME || os.hostname(),
            nodeEnv: this.configService.nodeEnv,
          },
        },
        update: {
          lastSeenAt: new Date(),
          meta: {
            pid: process.pid,
            hostname: process.env.HOSTNAME || os.hostname(),
            nodeEnv: this.configService.nodeEnv,
          },
        },
      });
    } catch (err: any) {
      // Don't crash the worker if DB is temporarily unavailable.
      logger.error(
        { err: err?.message ?? String(err) },
        "Heartbeat write failed",
      );
    }
  }

  async cleanupOnce(log?: LoggerService): Promise<void> {
    const logger =
      log ??
      this.logger.child({
        component: "worker-heartbeat-cleanup",
        kind: this.kind,
        instanceId: this.instanceId,
      });

    const retentionHours = this.configService.workerHeartbeatRetentionHours;
    if (!Number.isFinite(retentionHours) || retentionHours <= 0) {
      logger.warn(
        { retentionHours },
        "Skipping heartbeat cleanup (invalid retention)",
      );
      return;
    }

    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    try {
      const result = await this.prisma.workerHeartbeat.deleteMany({
        where: {
          kind: this.kind,
          lastSeenAt: { lt: cutoff },
        },
      });

      if ((result?.count ?? 0) > 0) {
        logger.log(
          { deleted: result.count, cutoff: cutoff.toISOString() },
          "Deleted old worker heartbeats",
        );
      }
    } catch (err: any) {
      // Don't crash the worker if DB is temporarily unavailable.
      logger.error(
        { err: err?.message ?? String(err) },
        "Heartbeat cleanup failed",
      );
    }
  }
}
