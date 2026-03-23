import { Module } from "@nestjs/common";

import { RelationshipsModule } from "../relationships/relationships.module";

import { FollowUpsController } from "./follow-ups.controller";
import { FollowUpReminderLifecycleService } from "./follow-up-reminder-lifecycle.service";
import { FollowUpsService } from "./follow-ups.service";

@Module({
  imports: [RelationshipsModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService, FollowUpReminderLifecycleService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}