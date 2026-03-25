import { Module } from "@nestjs/common";

import { IdentitiesService } from "./identities.service";

@Module({
  providers: [IdentitiesService],
  exports: [IdentitiesService],
})
export class IdentitiesModule {}
