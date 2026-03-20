import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { EventsModule } from "../events/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PersonasModule } from "../personas/personas.module";
import { RelationshipsModule } from "../relationships/relationships.module";

import { ContactRequestsController } from "./contact-requests.controller";
import { ContactRequestsService } from "./contact-requests.service";
import { RequestRateLimitService } from "./request-rate-limit.service";

@Module({
  imports: [
    DatabaseModule,
    PersonasModule,
    RelationshipsModule,
    ContactMemoryModule,
    BlocksModule,
    EventsModule,
    NotificationsModule,
  ],
  controllers: [ContactRequestsController],
  providers: [ContactRequestsService, RequestRateLimitService],
  exports: [ContactRequestsService],
})
export class ContactRequestsModule {}
