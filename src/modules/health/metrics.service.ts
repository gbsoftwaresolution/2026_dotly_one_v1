import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CacheService } from "../../infrastructure/cache/cache.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { OperationalMetricsService } from "../../infrastructure/logging/operational-metrics.service";
import {
  AuthMetricsService,
  noopAuthMetricsService,
} from "../auth/auth-metrics.service";

@Injectable()
export class MetricsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly authMetricsService: AuthMetricsService = noopAuthMetricsService,
    private readonly operationalMetricsService: OperationalMetricsService = new OperationalMetricsService(),
  ) {}

  async getPrometheusSnapshot(): Promise<string> {
    const [database, cache] = await Promise.all([
      this.getDatabaseMetricValue(),
      this.getCacheMetricValue(),
    ]);

    const lines = [
      "# HELP dotly_service_info Static metadata for the running Dotly backend instance",
      "# TYPE dotly_service_info gauge",
      `dotly_service_info{service="dotly-backend",environment="${this.configService.get<string>("app.nodeEnv", "development")}"} 1`,
      "# HELP dotly_database_up Database readiness indicator",
      "# TYPE dotly_database_up gauge",
      `dotly_database_up ${database}`,
      "# HELP dotly_cache_up Redis cache readiness indicator",
      "# TYPE dotly_cache_up gauge",
      `dotly_cache_up ${cache}`,
    ];

    return `${lines.join("\n")}\n${this.operationalMetricsService.renderPrometheusMetrics()}${this.authMetricsService.renderPrometheusMetrics()}`;
  }

  private async getDatabaseMetricValue(): Promise<0 | 1> {
    try {
      await this.prismaService.$queryRawUnsafe("SELECT 1");
      return 1;
    } catch {
      return 0;
    }
  }

  private async getCacheMetricValue(): Promise<0 | 1> {
    const health = await this.cacheService.getHealthStatus({
      attemptConnection: false,
    });

    return health.status === "up" ? 1 : 0;
  }
}
