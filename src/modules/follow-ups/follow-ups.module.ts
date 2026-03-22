import { Module } from "@nestjs/common";

import { RelationshipsModule } from "../relationships/relationships.module";

import { FollowUpsController } from "./follow-ups.controller";
import { FollowUpsService } from "./follow-ups.service";

@Module({
  imports: [RelationshipsModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}