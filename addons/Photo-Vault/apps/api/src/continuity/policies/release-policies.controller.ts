import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ReleasePoliciesService } from "./release-policies.service";

@Controller("continuity/policies")
@UseGuards(JwtAuthGuard)
export class ReleasePoliciesController {
  constructor(private readonly policiesService: ReleasePoliciesService) {}

  @Post()
  create(@Request() req, @Body() createDto: any) {
    return this.policiesService.create(req.user.id, createDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.policiesService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req, @Param("id") id: string) {
    return this.policiesService.findOne(req.user.id, id);
  }

  @Put(":id")
  update(@Request() req, @Param("id") id: string, @Body() updateDto: any) {
      return this.policiesService.update(req.user.id, id, updateDto);
  }

  @Delete(":id")
  remove(@Request() req, @Param("id") id: string) {
      return this.policiesService.remove(req.user.id, id);
  }

  @Post(":id/check-in")
  checkIn(@Request() req, @Param("id") id: string) {
      return this.policiesService.checkIn(req.user.id, id);
  }
}
