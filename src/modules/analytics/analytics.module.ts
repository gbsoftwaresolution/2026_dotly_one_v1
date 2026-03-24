import { Module } from "@nestjs/common";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { MeAnalyticsController } from "./me-analytics.controller";

@Module({
  controllers: [AnalyticsController, MeAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
