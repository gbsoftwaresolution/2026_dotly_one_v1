import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { PersonasModule } from "../personas/personas.module";
import { RelationshipsModule } from "../relationships/relationships.module";

import { ContactRequestsController } from "./contact-requests.controller";
import { ContactRequestsService } from "./contact-requests.service";

@Module({
  imports: [
    PersonasModule,
    RelationshipsModule,
    ContactMemoryModule,
    BlocksModule,
  ],
  controllers: [ContactRequestsController],
  providers: [ContactRequestsService],
  exports: [ContactRequestsService],
})
export class ContactRequestsModule {}
