import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { getClientIpAddress } from "../../common/utils/request-source.util";
import { ChangePasswordDto } from "../auth/dto/change-password.dto";
import { RequestMobileOtpDto } from "../auth/dto/request-mobile-otp.dto";
import { RevokeSessionDto } from "../auth/dto/revoke-session.dto";
import { VerifyMobileOtpDto } from "../auth/dto/verify-mobile-otp.dto";

import { UsersService } from "./users.service";

type RequestLike = {
  ip?: string;
  headers?: { [key: string]: string | string[] | undefined };
  socket?: { remoteAddress?: string };
};

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private buildRequestContext(
    requestId?: string,
    userAgent?: string,
    request?: RequestLike,
    sessionId?: string,
  ) {
    return {
      requestId,
      userAgent,
      sessionId,
      ipAddress: getClientIpAddress(request),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/verification/resend")
  @HttpCode(200)
  resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.usersService.resendVerificationEmail(
      user.id,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/password/change")
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.usersService.changePassword(
      user.id,
      changePasswordDto,
      user.sessionId,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/mobile-otp/request")
  @HttpCode(200)
  requestMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() requestMobileOtpDto: RequestMobileOtpDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.usersService.requestMobileOtp(
      user.id,
      requestMobileOtpDto,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/mobile-otp/verify")
  @HttpCode(200)
  verifyMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyMobileOtpDto: VerifyMobileOtpDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.usersService.verifyMobileOtp(
      user.id,
      verifyMobileOtpDto,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/sessions")
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listSessions(user.id, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/sessions/revoke")
  @HttpCode(200)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() revokeSessionDto: RevokeSessionDto,
  ) {
    return this.usersService.revokeSession(
      user.id,
      user.sessionId ?? "",
      revokeSessionDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/sessions/revoke-others")
  @HttpCode(200)
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.revokeOtherSessions(user.id, user.sessionId ?? "");
  }
}
