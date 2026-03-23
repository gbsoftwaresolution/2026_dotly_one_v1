import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { EventsModule } from "../events/events.module";

import { RelationshipsController } from "./relationships.controller";
import { InstantConnectSourcePolicyService } from "./instant-connect-source-policy.service";
import { RelationshipsService } from "./relationships.service";

@Module({
  imports: [BlocksModule, ContactMemoryModule, EventsModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService, InstantConnectSourcePolicyService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
