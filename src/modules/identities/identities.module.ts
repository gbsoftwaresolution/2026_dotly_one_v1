import { Module } from "@nestjs/common";

import { ActionEnforcementService } from "./action-enforcement.service";
import { IdentitiesService } from "./identities.service";

@Module({
  providers: [IdentitiesService, ActionEnforcementService],
  exports: [IdentitiesService, ActionEnforcementService],
})
export class IdentitiesModule {}
