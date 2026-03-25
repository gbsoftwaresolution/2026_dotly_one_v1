import { Controller, Post, Body, Param, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ContinuityReleasesService } from "./continuity-releases.service";

@Controller("continuity/releases")
@UseGuards(JwtAuthGuard)
export class ContinuityReleasesController {
  constructor(private readonly releasesService: ContinuityReleasesService) {}

  @Post("execute")
  execute(@Request() req, @Body() body: { packId: string }) {
    return this.releasesService.executeRelease(req.user.id, body.packId);
  }

  @Post(":id/revoke")
  revoke(@Request() req, @Param("id") id: string) {
    return this.releasesService.revokeRelease(req.user.id, id);
  }
}
