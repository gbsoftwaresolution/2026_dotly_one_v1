import { Module } from "@nestjs/common";

import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { RelationshipsModule } from "../relationships/relationships.module";

import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [ContactMemoryModule, RelationshipsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
