import { Module } from "@nestjs/common";

import { SupportController } from "./support.controller";
import { SupportBotProtectionService } from "./support-bot-protection.service";
import { SupportRateLimitService } from "./support-rate-limit.service";
import { SupportService } from "./support.service";

@Module({
  controllers: [SupportController],
  providers: [
    SupportService,
    SupportRateLimitService,
    SupportBotProtectionService,
  ],
  exports: [SupportService],
})
export class SupportModule {}
