import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PersonasModule } from "../personas/personas.module";

import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  imports: [PersonasModule, BlocksModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
