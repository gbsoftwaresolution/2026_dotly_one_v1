import { Module } from "@nestjs/common";

import { AgenciesController } from "./agencies.controller";
import { PublicAgenciesController } from "./public-agencies.controller";
import { AgenciesService } from "./agencies.service";

@Module({
  controllers: [AgenciesController, PublicAgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
