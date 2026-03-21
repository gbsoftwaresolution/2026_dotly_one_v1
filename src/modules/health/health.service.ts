import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CacheService } from "../../infrastructure/cache/cache.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

type HealthCheckStatus = "up" | "down" | "degraded" | "disabled";

interface ComponentHealth {
  status: HealthCheckStatus;
  message?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness() {
    return {
      service: "dotly-backend",
      status: "ok" as const,
      environment: this.configService.get<string>("app.nodeEnv", "development"),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const [database, cache] = await Promise.all([
      this.getDatabaseHealth(),
      this.cacheService.getHealthStatus({ attemptConnection: false }),
    ]);

    const status =
      database.status === "up" ? this.toOverallStatus(cache) : "down";

    return {
      service: "dotly-backend",
      status,
      environment: this.configService.get<string>("app.nodeEnv", "development"),
      timestamp: new Date().toISOString(),
      checks: {
        database,
        cache,
      },
    };
  }

  private async getDatabaseHealth(): Promise<ComponentHealth> {
    try {
      await this.prismaService.$queryRawUnsafe("SELECT 1");

      return {
        status: "up",
      };
    } catch {
      return {
        status: "down",
        message: "Database connection unavailable.",
      };
    }
  }

  private toOverallStatus(cache: ComponentHealth): "ok" | "degraded" {
    return cache.status === "down" || cache.status === "degraded"
      ? "degraded"
      : "ok";
  }
}
