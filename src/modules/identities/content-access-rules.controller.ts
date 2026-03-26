import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import {
  ConnectionContentParamDto,
  GetContentAccessRuleQueryDto,
  ResolveContentPermissionsQueryDto,
  SetContentAccessRuleRequestDto,
} from "./dto/identity-http-route.dto";
import { IdentitiesService } from "./identities.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class ContentAccessRulesController {
  constructor(private readonly identitiesService: IdentitiesService) {}

  @Put("content-access-rules")
  setContentAccessRule(@Body() body: SetContentAccessRuleRequestDto) {
    return this.identitiesService.setContentAccessRule(body);
  }

  @Get("content-access-rules")
  getContentAccessRule(@Query() query: GetContentAccessRuleQueryDto) {
    return this.identitiesService.getContentAccessRule(query);
  }

  @Get("identity-connections/:connectionId/content/:contentId/permissions")
  resolveContentPermissions(
    @Param() params: ConnectionContentParamDto,
    @Query() query: ResolveContentPermissionsQueryDto,
  ) {
    return this.identitiesService.resolveContentPermissionsForConnection({
      connectionId: params.connectionId,
      contentId: params.contentId,
      targetIdentityId: query.targetIdentityId,
      currentViewCount: query.currentViewCount,
      persistSnapshot: query.persistSnapshot,
    });
  }
}
