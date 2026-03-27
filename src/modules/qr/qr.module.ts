import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PersonasModule } from "../personas/personas.module";
import { RelationshipsModule } from "../relationships/relationships.module";
import { UsersModule } from "../users/users.module";

import { QrController } from "./qr.controller";
import { QrService } from "./qr.service";

@Module({
  imports: [
    AnalyticsModule,
    PersonasModule,
    BlocksModule,
    RelationshipsModule,
    ContactMemoryModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
