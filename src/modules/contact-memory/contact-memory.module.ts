import { Module } from "@nestjs/common";

import { ContactMemoryService } from "./contact-memory.service";

@Module({
  providers: [ContactMemoryService],
  exports: [ContactMemoryService],
})
export class ContactMemoryModule {}
