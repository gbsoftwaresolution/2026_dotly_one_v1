import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateFollowUpDto } from "./dto/create-follow-up.dto";
import { ListFollowUpsQueryDto } from "./dto/list-follow-ups-query.dto";
import { UpdateFollowUpDto } from "./dto/update-follow-up.dto";
import { FollowUpsService } from "./follow-ups.service";

@UseGuards(JwtAuthGuard)
@Controller("follow-ups")
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createFollowUpDto: CreateFollowUpDto,
  ) {
    return this.followUpsService.createFollowUp(user.id, createFollowUpDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFollowUpsQueryDto,
  ) {
    return this.followUpsService.listFollowUps(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.followUpsService.getFollowUp(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateFollowUpDto: UpdateFollowUpDto,
  ) {
    return this.followUpsService.updateFollowUp(user.id, id, updateFollowUpDto);
  }

  @Post(":id/complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.followUpsService.completeFollowUp(user.id, id);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.followUpsService.cancelFollowUp(user.id, id);
  }
}