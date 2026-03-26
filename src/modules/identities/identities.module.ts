import { AIEnforcementService } from "./ai-enforcement.service";
import { Module } from "@nestjs/common";

import { ActionEnforcementService } from "./action-enforcement.service";
import { CallEnforcementService } from "./call-enforcement.service";
import { IdentitiesService } from "./identities.service";

@Module({
  providers: [
    IdentitiesService,
    AIEnforcementService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
  exports: [
    IdentitiesService,
    AIEnforcementService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
})
export class IdentitiesModule {}
