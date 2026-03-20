import { Module } from "@nestjs/common";

import { ContactMemoryController } from "./contact-memory.controller";
import { ContactMemoryService } from "./contact-memory.service";

@Module({
  controllers: [ContactMemoryController],
  providers: [ContactMemoryService],
  exports: [ContactMemoryService],
})
export class ContactMemoryModule {}
