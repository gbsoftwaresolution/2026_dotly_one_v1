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
import { ActivationMilestonesService } from "../users/activation-milestones.service";

import { CreatePersonaDto } from "./dto/create-persona.dto";
import { UpdatePersonaSharingDto } from "./dto/update-persona-sharing.dto";
import { UpdatePersonaDto } from "./dto/update-persona.dto";

import { PersonasService } from "./personas.service";

@UseGuards(JwtAuthGuard)
@Controller("personas")
export class PersonasController {
  constructor(
    private readonly personasService: PersonasService,
    private readonly activationMilestonesService: ActivationMilestonesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createPersonaDto: CreatePersonaDto,
  ) {
    const persona = await this.personasService.create(user.id, createPersonaDto);

    await this.activationMilestonesService.markFirstPersonaCreated(
      user.id,
      new Date(persona.createdAt),
    );

    return persona;
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
  async findFastSharePayload(@CurrentUser() user: AuthenticatedUser) {
    const payload = await this.personasService.getMyFastSharePayload(user.id);

    if (payload.persona) {
      await this.activationMilestonesService.markFirstQrOpened(user.id);
    }

    return payload;
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
