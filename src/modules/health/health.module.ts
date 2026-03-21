import { Module } from "@nestjs/common";

import { CacheInfrastructureModule } from "../../infrastructure/cache/cache.module";
import { DatabaseModule } from "../../infrastructure/database/database.module";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { MetricsService } from "./metrics.service";

@Module({
  imports: [DatabaseModule, CacheInfrastructureModule],
  controllers: [HealthController],
  providers: [HealthService, MetricsService],
})
export class HealthModule {}
