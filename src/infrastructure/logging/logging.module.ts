import { Global, Module } from "@nestjs/common";

import { AppLoggerService } from "./logging.service";
import { SecurityAuditService } from "./security-audit.service";

@Global()
@Module({
  providers: [AppLoggerService, SecurityAuditService],
  exports: [AppLoggerService, SecurityAuditService],
})
export class LoggingModule {}
