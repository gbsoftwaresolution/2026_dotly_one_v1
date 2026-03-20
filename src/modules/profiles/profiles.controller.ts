import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { buildAnalyticsRequestKey } from "../analytics/analytics-request.util";
import { ProfilesService } from "./profiles.service";

@Controller("public")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":username/request-target")
  getRequestTarget(@Param("username") username: string) {
    return this.profilesService.getRequestTarget(username);
  }

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
