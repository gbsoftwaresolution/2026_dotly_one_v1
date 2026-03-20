import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateContactRequestDto } from "./dto/create-contact-request.dto";

import { ContactRequestsService } from "./contact-requests.service";

@UseGuards(JwtAuthGuard)
@Controller("contact-requests")
export class ContactRequestsController {
  constructor(
    private readonly contactRequestsService: ContactRequestsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createContactRequestDto: CreateContactRequestDto,
  ) {
    return this.contactRequestsService.create(user.id, createContactRequestDto);
  }

  @Get("incoming")
  findIncoming(@CurrentUser() user: AuthenticatedUser) {
    return this.contactRequestsService.findIncoming(user.id);
  }

  @Get("outgoing")
  findOutgoing(@CurrentUser() user: AuthenticatedUser) {
    return this.contactRequestsService.findOutgoing(user.id);
  }

  @Post(":requestId/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ) {
    return this.contactRequestsService.approve(user.id, requestId);
  }

  @Post(":requestId/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("requestId", new ParseUUIDPipe()) requestId: string,
  ) {
    return this.contactRequestsService.reject(user.id, requestId);
  }
}
