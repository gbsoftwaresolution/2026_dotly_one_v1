import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";
import { MailModule } from "../mail/mail.module";
import { ContinuityPacksController } from "./packs/continuity-packs.controller";
import { ContinuityPacksService } from "./packs/continuity-packs.service";
import { ReleasePoliciesController } from "./policies/release-policies.controller";
import { ReleasePoliciesService } from "./policies/release-policies.service";
import { ContinuityRecipientsController } from "./recipients/continuity-recipients.controller";
import { ContinuityRecipientsService } from "./recipients/continuity-recipients.service";
import { ContinuityReleasesController } from "./releases/continuity-releases.controller";
import { ContinuityReleasesService } from "./releases/continuity-releases.service";
import { HeirController } from "./heir/heir.controller";
import { HeirService } from "./heir/heir.service";
import { ContinuitySchedulerService } from "./continuity.scheduler";
import { HeirAuthGuard } from "../auth/guards/heir-auth.guard";

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule, MailModule],
  controllers: [
      ContinuityPacksController,
      ReleasePoliciesController,
      ContinuityRecipientsController,
      ContinuityReleasesController,
      HeirController
  ],
  providers: [
      ContinuityPacksService,
      ReleasePoliciesService,
      ContinuityRecipientsService,
      ContinuityReleasesService,
      HeirService,
      HeirAuthGuard,
      ContinuitySchedulerService
  ],
  exports: [],
})
export class ContinuityModule {}
