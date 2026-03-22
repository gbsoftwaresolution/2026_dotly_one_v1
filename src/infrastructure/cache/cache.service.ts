import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

import { AppLoggerService } from "../logging/logging.service";

type CacheClient = ReturnType<typeof createClient>;
type CacheHealthOptions = {
  attemptConnection?: boolean;
};

@Injectable()
export class CacheService implements OnModuleDestroy {
  private client: CacheClient | null = null;
  private connectPromise: Promise<CacheClient | null> | null = null;
  private lastConnectionError: string | null = null;
  private lastConnectionAttemptAt: Date | null = null;
  private hasLoggedDisconnectedState = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  getRedisUrl(): string {
    return this.configService.get<string>(
      "redis.url",
      "redis://localhost:6379",
    );
  }

  isEnabled(): boolean {
    return this.configService.get<boolean>("redis.enabled", true);
  }

  async ensureConnection(): Promise<CacheClient | null> {
    if (!this.isEnabled()) {
      return null;
    }

    if (this.client?.isOpen) {
      return this.client;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const client = createClient({
      url: this.getRedisUrl(),
    });
    this.lastConnectionAttemptAt = new Date();

    client.on("error", (error) => {
      this.lastConnectionError = error.message;
      this.logger.warn(`Redis client error: ${error.message}`, "CacheService");
    });

    this.connectPromise = client
      .connect()
      .then(() => {
        this.client = client;
        this.lastConnectionError = null;
        this.hasLoggedDisconnectedState = false;
        this.logger.log("Redis cache connection established", "CacheService");

        return client;
      })
      .catch((error: Error) => {
        this.lastConnectionError = error.message;
        this.logger.warn(
          `Redis unavailable, continuing without cache: ${error.message}`,
          "CacheService",
        );
        this.client = null;
        void client.disconnect().catch(() => undefined);

        return null;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean | null> {
    const client = await this.ensureConnection();

    if (!client) {
      return null;
    }

    const result = await client.set(key, value, {
      NX: true,
      EX: ttlSeconds,
    });

    return result === "OK";
  }

  async get(key: string): Promise<string | null> {
    const client = await this.ensureConnection();

    if (!client) {
      return null;
    }

    return client.get(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    const client = await this.ensureConnection();

    if (!client) {
      return null;
    }

    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }

    return count;
  }

  async getHealthStatus(): Promise<{
    status: "up" | "down" | "degraded" | "disabled";
    message?: string;
    attemptedConnection?: boolean;
    lastConnectionAttemptAt?: string;
  }>;
  async getHealthStatus(options: CacheHealthOptions): Promise<{
    status: "up" | "down" | "degraded" | "disabled";
    message?: string;
    attemptedConnection?: boolean;
    lastConnectionAttemptAt?: string;
  }>;
  async getHealthStatus(options?: CacheHealthOptions): Promise<{
    status: "up" | "down" | "degraded" | "disabled";
    message?: string;
    attemptedConnection?: boolean;
    lastConnectionAttemptAt?: string;
  }> {
    if (!this.isEnabled()) {
      return {
        status: "disabled",
        message: "Redis integration is disabled by configuration.",
        attemptedConnection: false,
      };
    }

    const shouldAttemptConnection = options?.attemptConnection ?? false;
    const client = this.client?.isOpen
      ? this.client
      : shouldAttemptConnection
        ? await this.ensureConnection()
        : null;

    const lastConnectionAttemptAt =
      this.lastConnectionAttemptAt?.toISOString() ?? undefined;

    if (!client) {
      const message =
        this.lastConnectionError ??
        "Redis connection is not available. Runtime continues without cache.";

      if (!shouldAttemptConnection && !this.hasLoggedDisconnectedState) {
        this.logger.warn(
          `Redis health check skipped active reconnect: ${message}`,
          "CacheService",
        );
        this.hasLoggedDisconnectedState = true;
      }

      return {
        status: "degraded",
        message,
        attemptedConnection: shouldAttemptConnection,
        lastConnectionAttemptAt,
      };
    }

    try {
      const result = await client.ping();

      if (result !== "PONG") {
        return {
          status: "down",
          message: "Redis ping returned an unexpected response.",
        };
      }

      return {
        status: "up",
        attemptedConnection: shouldAttemptConnection,
        lastConnectionAttemptAt,
      };
    } catch (error) {
      return {
        status: "down",
        message:
          error instanceof Error ? error.message : "Redis health check failed.",
        attemptedConnection: shouldAttemptConnection,
        lastConnectionAttemptAt,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }
}
