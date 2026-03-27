import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { EventsModule } from "../events/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PersonasModule } from "../personas/personas.module";
import { RelationshipsModule } from "../relationships/relationships.module";
import { UsersModule } from "../users/users.module";

import { ContactRequestsController } from "./contact-requests.controller";
import { ContactRequestCreateService } from "./contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "./contact-request-recipient-policy.service";
import { ContactRequestRetryPolicyService } from "./contact-request-retry-policy.service";
import { ContactRequestRespondService } from "./contact-request-respond.service";
import { ContactRequestSourcePolicyService } from "./contact-request-source-policy.service";
import { ContactRequestsService } from "./contact-requests.service";
import { RequestRateLimitService } from "./request-rate-limit.service";

@Module({
  imports: [
    DatabaseModule,
    AnalyticsModule,
    PersonasModule,
    RelationshipsModule,
    ContactMemoryModule,
    BlocksModule,
    EventsModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [ContactRequestsController],
  providers: [
    ContactRequestsService,
    ContactRequestCreateService,
    ContactRequestRecipientPolicyService,
    ContactRequestRetryPolicyService,
    ContactRequestSourcePolicyService,
    ContactRequestRespondService,
    RequestRateLimitService,
  ],
  exports: [ContactRequestsService],
})
export class ContactRequestsModule {}
