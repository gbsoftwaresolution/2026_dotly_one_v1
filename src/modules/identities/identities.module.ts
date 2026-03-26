import { AIEnforcementService } from "./ai-enforcement.service";
import { Module } from "@nestjs/common";

import { ActionEnforcementService } from "./action-enforcement.service";
import { CallEnforcementService } from "./call-enforcement.service";
import { IdentitiesService } from "./identities.service";
import { PermissionAuditService } from "./permission-audit";

@Module({
  providers: [
    IdentitiesService,
    PermissionAuditService,
    AIEnforcementService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
  exports: [
    IdentitiesService,
    PermissionAuditService,
    AIEnforcementService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
})
export class IdentitiesModule {}
