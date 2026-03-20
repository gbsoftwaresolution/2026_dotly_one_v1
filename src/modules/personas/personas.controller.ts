import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreatePersonaDto } from "./dto/create-persona.dto";
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

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.personasService.findAllByUser(user.id);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.findOneById(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updatePersonaDto: UpdatePersonaDto,
  ) {
    return this.personasService.update(user.id, id, updatePersonaDto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.personasService.remove(user.id, id);
  }
}
