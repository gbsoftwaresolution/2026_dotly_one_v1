import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateInstantConnectDto } from "./dto/create-instant-connect.dto";
import { CreatePublicInstantConnectDto } from "./dto/create-public-instant-connect.dto";
import { UpdateRelationshipDto } from "./dto/update-relationship.dto";
import { RelationshipsService } from "./relationships.service";

@UseGuards(JwtAuthGuard)
@Controller("relationships")
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Post("instant-connect")
  @HttpCode(HttpStatus.OK)
  instantConnect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createInstantConnectDto: CreateInstantConnectDto,
  ) {
    return this.relationshipsService.instantConnect(
      user.id,
      createInstantConnectDto,
    );
  }

  @Post("instant-connect/by-username/:username")
  @HttpCode(HttpStatus.OK)
  instantConnectByUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Param("username") username: string,
    @Body() createInstantConnectDto: CreatePublicInstantConnectDto,
  ) {
    return this.relationshipsService.instantConnectByUsername(
      user.id,
      username,
      createInstantConnectDto,
    );
  }

  @Patch(":id")
  updateRelationship(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateRelationshipDto: UpdateRelationshipDto,
  ) {
    return this.relationshipsService.updateOwnedRelationshipNotes(
      user.id,
      id,
      updateRelationshipDto,
    );
  }
}
