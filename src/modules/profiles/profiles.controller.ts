import { Controller, Get, Param, Req } from "@nestjs/common";
import type { Request } from "express";

import { buildAnalyticsRequestKey } from "../analytics/analytics-request.util";
import { ProfilesService } from "./profiles.service";

@Controller("public")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(":username")
  getPublicProfile(
    @Param("username") username: string,
    @Req() request: Request,
  ) {
    return this.profilesService.getPublicProfile(username, {
      idempotencyKey: buildAnalyticsRequestKey(
        request,
        `public-profile:${username.trim().toLowerCase()}`,
      ),
    });
  }
}
