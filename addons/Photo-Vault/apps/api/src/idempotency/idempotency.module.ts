import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
