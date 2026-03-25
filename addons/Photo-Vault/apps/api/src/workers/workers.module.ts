import { Module } from "@nestjs/common";
import { ExportsModule } from "../exports/exports.module";
import { ExportsProcessor } from "../exports/exports.processor";
import { ExportsSchedulerService } from "../exports/exports.scheduler.service";
import { MediaModule } from "../media/media.module";
import { PurgeProcessor } from "../media/purge.processor";
import { PurgeSchedulerService } from "../media/purge.scheduler.service";
import { ThumbnailsProcessor } from "../media/thumbnails.processor";
import { ThumbnailsSchedulerService } from "../media/thumbnails.scheduler.service";
import { LifeDocsModule } from "../life-docs/life-docs.module";
import { LifeDocsRemindersProcessor } from "../life-docs/reminders/life-docs-reminders.processor";
import { LifeDocsRemindersQueue } from "../life-docs/reminders/life-docs-reminders.queue";
import { LifeDocsRemindersSchedulerService } from "../life-docs/reminders/life-docs-reminders.scheduler.service";
import { LifeDocsRemindersService } from "../life-docs/reminders/life-docs-reminders.service";
import { WorkerHeartbeatService } from "./worker-heartbeat.service";

@Module({
  imports: [ExportsModule, MediaModule, LifeDocsModule],
  providers: [
    WorkerHeartbeatService,
    ExportsProcessor,
    ExportsSchedulerService,
    PurgeProcessor,
    PurgeSchedulerService,
    ThumbnailsProcessor,
    ThumbnailsSchedulerService,
    LifeDocsRemindersQueue,
    LifeDocsRemindersService,
    LifeDocsRemindersProcessor,
    LifeDocsRemindersSchedulerService,
  ],
})
export class WorkersModule {}
