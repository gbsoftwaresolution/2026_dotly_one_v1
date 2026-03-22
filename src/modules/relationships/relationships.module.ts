import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";

import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

@Module({
  imports: [BlocksModule, ContactMemoryModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
