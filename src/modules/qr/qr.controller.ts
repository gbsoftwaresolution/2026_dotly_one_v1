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

import { ConnectQuickConnectQrDto } from "./dto/connect-quick-connect-qr.dto";
import { CreateQuickConnectQrDto } from "./dto/create-quick-connect-qr.dto";

import { QrService } from "./qr.service";

@Controller()
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @UseGuards(JwtAuthGuard)
  @Post("personas/:personaId/qr/profile")
  createProfileQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("personaId", new ParseUUIDPipe()) personaId: string,
  ) {
    return this.qrService.createProfileQr(user.id, personaId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("personas/:personaId/qr/quick-connect")
  createQuickConnectQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("personaId", new ParseUUIDPipe()) personaId: string,
    @Body() createQuickConnectQrDto: CreateQuickConnectQrDto,
  ) {
    return this.qrService.createQuickConnectQr(
      user.id,
      personaId,
      createQuickConnectQrDto,
    );
  }

  @Get("qr/:code")
  resolveQr(@Param("code") code: string) {
    return this.qrService.resolveQr(code);
  }

  @UseGuards(JwtAuthGuard)
  @Post("qr/:code/connect")
  connectQuickConnectQr(
    @CurrentUser() user: AuthenticatedUser,
    @Param("code") code: string,
    @Body() connectQuickConnectQrDto: ConnectQuickConnectQrDto,
  ) {
    return this.qrService.connectQuickConnectQr(
      user.id,
      code,
      connectQuickConnectQrDto,
    );
  }
}
