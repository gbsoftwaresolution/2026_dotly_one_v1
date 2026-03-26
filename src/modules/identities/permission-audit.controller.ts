import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { ListPermissionAuditEventsQueryDto } from "./dto/identity-http-route.dto";
import { IdentitiesService } from "./identities.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class PermissionAuditController {
  constructor(private readonly identitiesService: IdentitiesService) {}

  @Get("permission-audit-events")
  listPermissionAuditEvents(@Query() query: ListPermissionAuditEventsQueryDto) {
    return this.identitiesService.listPermissionAuditEvents(query);
  }
}
