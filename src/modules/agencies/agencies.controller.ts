import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { UpdateAgencyProfileDto } from "./dto/update-agency-profile.dto";

import { AgenciesService } from "./agencies.service";

@UseGuards(JwtAuthGuard)
@Controller("agencies")
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post("me")
  createMyAgencyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createAgencyProfileDto: CreateAgencyProfileDto,
  ) {
    return this.agenciesService.createMyAgencyProfile(
      user.id,
      createAgencyProfileDto,
    );
  }

  @Get("me")
  findMyAgencyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.findMyAgencyProfile(user.id);
  }

  @Patch("me")
  updateMyAgencyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateAgencyProfileDto: UpdateAgencyProfileDto,
  ) {
    return this.agenciesService.updateMyAgencyProfile(
      user.id,
      updateAgencyProfileDto,
    );
  }
}
