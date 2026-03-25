import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";
import { SharingService } from "./sharing.service";
import { SharingController } from "./sharing.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  providers: [SharingService],
  controllers: [SharingController],
  exports: [SharingService],
})
export class SharingModule {}
