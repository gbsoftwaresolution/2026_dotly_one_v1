import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import IORedis from "ioredis";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class RedisService implements OnApplicationShutdown {
  public readonly client: IORedis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const log = this.logger.child({ component: "redis" });

    this.client = new IORedis(this.configService.redisUrl, {
      // BullMQ recommends disabling this so commands can be retried during downtime.
      // See: https://docs.bullmq.io/guide/connections
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.client.on("connect", () => {
      log.log({ redisUrl: this.configService.redisUrl }, "Redis connected");
    });

    this.client.on("error", (err) => {
      log.error({ err: err?.message ?? String(err) }, "Redis error");
    });
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
