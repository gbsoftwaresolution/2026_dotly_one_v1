import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { AnalyticsService } from "./analytics.service";

@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("analytics")
  getMyAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getMyAnalytics(user.id);
  }
}
