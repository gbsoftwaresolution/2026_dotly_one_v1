import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ContinuityRecipientsService } from "./continuity-recipients.service";

@Controller("continuity/recipients")
@UseGuards(JwtAuthGuard)
export class ContinuityRecipientsController {
  constructor(private readonly recipientsService: ContinuityRecipientsService) {}

  @Post()
  create(@Request() req, @Body() createDto: any) {
    return this.recipientsService.create(req.user.id, createDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.recipientsService.findAll(req.user.id);
  }

  @Delete(":id")
  remove(@Request() req, @Param("id") id: string) {
      return this.recipientsService.remove(req.user.id, id);
  }
}
