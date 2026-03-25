import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { HeirAuthGuard } from "../../auth/guards/heir-auth.guard";
import { HeirService } from "./heir.service";

@Controller("heir")
export class HeirController {
  constructor(private readonly heirService: HeirService) {}

  @Post("login")
  async login(@Body() body: { email: string; accessCode: string }) {
      return this.heirService.login(body.email, body.accessCode);
  }

  @UseGuards(HeirAuthGuard)
  @Get("releases")
  getReleases(@Request() req) {
      return this.heirService.getReleases((req as any).heir);
  }

  @UseGuards(HeirAuthGuard)
  @Get("releases/:releaseId")
  getRelease(@Request() req, @Param("releaseId") releaseId: string) {
      return this.heirService.getRelease((req as any).heir, releaseId);
  }

  @UseGuards(HeirAuthGuard)
  @Get("releases/:releaseId/items")
  getReleaseItems(@Request() req, @Param("releaseId") releaseId: string) {
      return this.heirService.getReleaseItems((req as any).heir, releaseId);
  }

  @UseGuards(HeirAuthGuard)
  @Get("releases/:releaseId/items/:itemId/open")
  openItem(@Request() req, @Param("releaseId") releaseId: string, @Param("itemId") itemId: string) {
      return this.heirService.openItem((req as any).heir, releaseId, itemId);
  }
}
