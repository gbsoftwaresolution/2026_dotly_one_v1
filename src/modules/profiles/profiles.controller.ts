import { Controller, Get, Param, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

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

  @Get("personas/:username/vcard")
  async getPublicVcard(
    @Param("username") username: string,
    @Res() response: Response,
  ) {
    const vcard = await this.profilesService.getPublicVcard(username);

    response.setHeader("content-type", "text/vcard; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${vcard.filename}"`,
    );
    response.send(vcard.content);
  }

  @Get("personas/:username")
  getPublicProfileByPersonaPath(
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
