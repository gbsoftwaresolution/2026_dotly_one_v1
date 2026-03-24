import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("persona/:personaId")
  getPersonaAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param("personaId", new ParseUUIDPipe()) personaId: string,
  ) {
    return this.analyticsService.getPersonaAnalytics(user.id, personaId);
  }

  @Get("summary")
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getSummary(user.id);
  }

  @Get("me")
  getMyAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getMyAnalytics(user.id);
  }
}
