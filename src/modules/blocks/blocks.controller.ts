import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { BlocksService } from "./blocks.service";

@UseGuards(JwtAuthGuard)
@Controller("blocks")
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post(":userId")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId", new ParseUUIDPipe()) blockedUserId: string,
  ) {
    return this.blocksService.create(user.id, blockedUserId);
  }

  @Delete(":userId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId", new ParseUUIDPipe()) blockedUserId: string,
  ) {
    return this.blocksService.remove(user.id, blockedUserId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.blocksService.findAll(user.id);
  }
}
