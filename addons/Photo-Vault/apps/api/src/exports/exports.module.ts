import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { ExportsService } from "./exports.service";
import { ExportsController } from "./exports.controller";
import { ExportsQueue } from "./exports.queue";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, StorageModule],
  providers: [ExportsService, ExportsQueue],
  controllers: [ExportsController],
  exports: [ExportsService, ExportsQueue],
})
export class ExportsModule {}
