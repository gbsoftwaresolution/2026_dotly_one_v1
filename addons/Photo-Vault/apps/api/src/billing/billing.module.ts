import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
