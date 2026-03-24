import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { getClientIpAddress } from "../../common/utils/request-source.util";

import { CreateSupportRequestDto } from "./dto/create-support-request.dto";
import { ListSupportRequestsQueryDto } from "./dto/list-support-requests-query.dto";
import { UpdateSupportRequestDto } from "./dto/update-support-request.dto";
import { SupportService } from "./support.service";

type RequestLike = {
  ip?: string;
  headers?: { [key: string]: string | string[] | undefined };
  socket?: { remoteAddress?: string };
};

@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(JwtAuthGuard)
  @Get("inbox")
  listInbox(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSupportRequestsQueryDto,
  ) {
    return this.supportService.listInbox(user.email, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("inbox/:id")
  updateInboxStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateSupportRequestDto: UpdateSupportRequestDto,
  ) {
    return this.supportService.updateInboxStatus(
      user,
      id,
      updateSupportRequestDto,
    );
  }

  @Post()
  @HttpCode(202)
  createSupportRequest(
    @Body() createSupportRequestDto: CreateSupportRequestDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.supportService.createRequest(createSupportRequestDto, {
      requestId,
      userAgent,
      ipAddress: getClientIpAddress(request),
    });
  }
}
