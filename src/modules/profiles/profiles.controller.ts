import { Controller, Get, Param, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { buildAnalyticsRequestKey } from "../analytics/analytics-request.util";
import { ProfilesService } from "./profiles.service";

@Controller("public")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":username/request-target")
  getRequestTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param("username") username: string,
  ) {
    return this.profilesService.getRequestTarget(user.id, username);
  }

  @UseGuards(JwtAuthGuard)
  @Get("personas/:username/vcard")
  async getPublicVcard(
    @CurrentUser() user: AuthenticatedUser,
    @Param("username") username: string,
    @Res() response: Response,
  ) {
    const vcard = await this.profilesService.getPublicVcard(username, user.id);

    response.setHeader("content-type", "text/vcard; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${vcard.filename}"`,
    );
    response.send(vcard.content);
  }

  @UseGuards(JwtAuthGuard)
  @Get("personas/:username")
  getPublicProfileByPersonaPath(
    @CurrentUser() user: AuthenticatedUser,
    @Param("username") username: string,
    @Req() request: Request,
  ) {
    return this.getPublicProfileResponse(user.id, username, request);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":username")
  getPublicProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("username") username: string,
    @Req() request: Request,
  ) {
    return this.getPublicProfileResponse(user.id, username, request);
  }

  private async getPublicProfileResponse(
    viewerUserId: string,
    username: string,
    request: Request,
  ) {
    return this.profilesService.getPublicProfile(username, {
      viewerUserId,
      idempotencyKey: buildAnalyticsRequestKey(
        request,
        `public-profile:${username.trim().toLowerCase()}`,
      ),
    });
  }
}
