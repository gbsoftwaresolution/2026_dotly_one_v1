import { Module } from "@nestjs/common";

import { PersonasModule } from "../personas/personas.module";

import { QrController } from "./qr.controller";
import { QrService } from "./qr.service";

@Module({
  imports: [PersonasModule],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
