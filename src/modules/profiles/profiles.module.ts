import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { BlocksModule } from "../blocks/blocks.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [AnalyticsModule, BlocksModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
