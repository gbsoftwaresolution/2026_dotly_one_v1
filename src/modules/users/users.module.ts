import { Module } from "@nestjs/common";

import { ActivationMilestonesService } from "./activation-milestones.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, ActivationMilestonesService],
  exports: [UsersService, ActivationMilestonesService],
})
export class UsersModule {}
