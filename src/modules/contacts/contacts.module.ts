import { Module } from "@nestjs/common";

import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { FollowUpsModule } from "../follow-ups/follow-ups.module";
import { RelationshipsModule } from "../relationships/relationships.module";

import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [ContactMemoryModule, RelationshipsModule, FollowUpsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
