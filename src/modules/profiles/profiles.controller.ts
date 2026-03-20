import { Controller, Get, Param } from "@nestjs/common";

import { ProfilesService } from "./profiles.service";

@Controller("public")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(":username")
  getPublicProfile(@Param("username") username: string) {
    return this.profilesService.getPublicProfile(username);
  }
}
