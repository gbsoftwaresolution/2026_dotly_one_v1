import { Module } from "@nestjs/common";

import { ActionEnforcementService } from "./action-enforcement.service";
import { CallEnforcementService } from "./call-enforcement.service";
import { IdentitiesService } from "./identities.service";

@Module({
  providers: [
    IdentitiesService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
  exports: [
    IdentitiesService,
    ActionEnforcementService,
    CallEnforcementService,
  ],
})
export class IdentitiesModule {}
