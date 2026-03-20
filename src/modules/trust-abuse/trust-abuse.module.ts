import { Module } from "@nestjs/common";

import { TrustAbuseController } from "./trust-abuse.controller";
import { TrustAbuseService } from "./trust-abuse.service";

@Module({
  controllers: [TrustAbuseController],
  providers: [TrustAbuseService],
  exports: [TrustAbuseService],
})
export class TrustAbuseModule {}
