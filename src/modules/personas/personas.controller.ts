import {
  Body,
  Controller,
  Delete,
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

import { CreatePersonaDto } from "./dto/create-persona.dto";
import { UpdatePersonaSharingDto } from "./dto/update-persona-sharing.dto";
import { UpdatePersonaDto } from "./dto/update-persona.dto";

import { PersonasService } from "./personas.service";

@UseGuards(JwtAuthGuard)
@Controller("personas")
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createPersonaDto: CreatePersonaDto,
  ) {
    return this.personasService.create(user.id, createPersonaDto);
  }

  @Get("availability/username")
  checkUsernameAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query("username") username: string,
  ) {
    return this.personasService.checkUsernameAvailability(user.id, username);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.personasService.findAllByUser(user.id);
  }

  @Get("me/share-fast")
  findFastSharePayload(@CurrentUser() user: AuthenticatedUser) {
    return this.personasService.getMyFastSharePayload(user.id);
  }

  @Get(":id/share-fast")
  findPersonaFastSharePayload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.getFastSharePayload(user.id, id);
  }

  @Get(":id/share")
  findSharePayload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.getPersonaShareMode(user.id, id);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.findOneById(user.id, id);
  }

  @Get(":id/user-identity")
  findUserIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.findOwnedPersonaUserIdentity(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updatePersonaDto: UpdatePersonaDto,
  ) {
    return this.personasService.update(user.id, id, updatePersonaDto);
  }

  @Patch(":id/sharing")
  updateSharingMode(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updatePersonaSharingDto: UpdatePersonaSharingDto,
  ) {
    return this.personasService.updateSharingMode(
      user.id,
      id,
      updatePersonaSharingDto,
    );
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.remove(user.id, id);
  }
}
