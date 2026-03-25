import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";
import { LifeDocsController } from "./life-docs.controller";
import { LifeDocsService } from "./life-docs.service";
import { LifeDocsCryptoService } from "./life-docs.crypto.service";

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [LifeDocsController],
  providers: [LifeDocsCryptoService, LifeDocsService],
  exports: [LifeDocsCryptoService, LifeDocsService],
})
export class LifeDocsModule {}
