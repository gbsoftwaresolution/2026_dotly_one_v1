import { Global, Module } from "@nestjs/common";

import { AppLoggerService } from "./logging.service";
import { OperationalMetricsService } from "./operational-metrics.service";
import { SecurityAuditService } from "./security-audit.service";

@Global()
@Module({
  providers: [
    AppLoggerService,
    SecurityAuditService,
    OperationalMetricsService,
  ],
  exports: [AppLoggerService, SecurityAuditService, OperationalMetricsService],
})
export class LoggingModule {}
