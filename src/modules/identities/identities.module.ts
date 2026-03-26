import { AIEnforcementService } from "./ai-enforcement.service";
import { Module } from "@nestjs/common";

import { ActionEnforcementService } from "./action-enforcement.service";
import { CallEnforcementService } from "./call-enforcement.service";
import { ContentAccessRulesController } from "./content-access-rules.controller";
import { IdentitiesService } from "./identities.service";
import { IdentitiesController } from "./identities.controller";
import { IdentityConversationsController } from "./identity-conversations.controller";
import { PermissionAuditService } from "./permission-audit";
import { PermissionAuditController } from "./permission-audit.controller";

@Module({
  controllers: [
    IdentitiesController,
    IdentityConversationsController,
    ContentAccessRulesController,
    PermissionAuditController,
  ],
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
