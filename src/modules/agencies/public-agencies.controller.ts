import { Controller, Get, Param } from "@nestjs/common";

import { AgenciesService } from "./agencies.service";

@Controller("public/agencies")
export class PublicAgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get(":slug")
  findPublicAgencyProfile(@Param("slug") slug: string) {
    return this.agenciesService.findPublicAgencyProfile(slug);
  }

  @Get(":slug/agents")
  findPublicAgencyAgents(@Param("slug") slug: string) {
    return this.agenciesService.findPublicAgencyAgents(slug);
  }
}
