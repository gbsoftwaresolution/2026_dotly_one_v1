import { Controller, Get, Param, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { buildAnalyticsRequestKey } from "../analytics/analytics-request.util";
import { ProfilesService } from "./profiles.service";

@Controller("public")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":publicIdentifier/request-target")
  getRequestTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param("publicIdentifier") publicIdentifier: string,
  ) {
    return this.profilesService.getRequestTarget(user.id, publicIdentifier);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("personas/:publicIdentifier/vcard")
  async getPublicVcard(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("publicIdentifier") publicIdentifier: string,
    @Res() response: Response,
  ) {
    const vcard = await this.profilesService.getPublicVcard(
      publicIdentifier,
      user?.id,
    );

    response.setHeader("content-type", "text/vcard; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${vcard.filename}"`,
    );
    response.send(vcard.content);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("personas/:publicIdentifier")
  getPublicProfileByPersonaPath(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("publicIdentifier") publicIdentifier: string,
    @Req() request: Request,
  ) {
    return this.getPublicProfileResponse(
      user?.id ?? null,
      publicIdentifier,
      request,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(":publicIdentifier")
  getPublicProfile(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("publicIdentifier") publicIdentifier: string,
    @Req() request: Request,
  ) {
    return this.getPublicProfileResponse(
      user?.id ?? null,
      publicIdentifier,
      request,
    );
  }

  private async getPublicProfileResponse(
    viewerUserId: string | null,
    publicIdentifier: string,
    request: Request,
  ) {
    return this.profilesService.getPublicProfile(publicIdentifier, {
      viewerUserId,
      idempotencyKey: buildAnalyticsRequestKey(
        request,
        `public-profile:${publicIdentifier.trim().toLowerCase()}`,
      ),
    });
  }
}
