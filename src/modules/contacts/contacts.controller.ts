import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactNoteDto } from "./dto/update-contact-note.dto";
import { ContactsService } from "./contacts.service";

@UseGuards(JwtAuthGuard)
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListContactsQueryDto,
  ) {
    return this.contactsService.findAll(user.id, query);
  }

  @Get(":relationshipId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", new ParseUUIDPipe()) relationshipId: string,
  ) {
    return this.contactsService.findOne(user.id, relationshipId);
  }

  @Patch(":relationshipId/note")
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("relationshipId", new ParseUUIDPipe()) relationshipId: string,
    @Body() updateContactNoteDto: UpdateContactNoteDto,
  ) {
    return this.contactsService.updateNote(
      user.id,
      relationshipId,
      updateContactNoteDto,
    );
  }
}
