import { Module } from "@nestjs/common";

import { ContactMemoryModule } from "../contact-memory/contact-memory.module";

import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [ContactMemoryModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
