import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateEventDto } from "./dto/create-event.dto";
import { JoinEventDto } from "./dto/join-event.dto";
import { ListEventsQueryDto } from "./dto/list-events-query.dto";

import { EventsService } from "./events.service";

@UseGuards(JwtAuthGuard)
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(user.id, createEventDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.eventsService.findAll(user.id, query);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.eventsService.findOne(user.id, id);
  }

  @Post(":id/join")
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() joinEventDto: JoinEventDto,
  ) {
    return this.eventsService.join(user.id, id, joinEventDto);
  }

  @Post(":id/discovery/enable")
  enableDiscovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.eventsService.enableDiscovery(user.id, id);
  }

  @Post(":id/discovery/disable")
  disableDiscovery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.eventsService.disableDiscovery(user.id, id);
  }

  @Get(":id/participants")
  findParticipants(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.eventsService.findVisibleParticipants(user.id, id);
  }
}
