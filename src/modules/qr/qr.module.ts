import { Module } from "@nestjs/common";

import { BlocksModule } from "../blocks/blocks.module";
import { ContactMemoryModule } from "../contact-memory/contact-memory.module";
import { PersonasModule } from "../personas/personas.module";
import { RelationshipsModule } from "../relationships/relationships.module";

import { QrController } from "./qr.controller";
import { QrService } from "./qr.service";

@Module({
  imports: [
    PersonasModule,
    BlocksModule,
    RelationshipsModule,
    ContactMemoryModule,
  ],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
