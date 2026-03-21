import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ChangePasswordDto } from "../auth/dto/change-password.dto";
import { RequestMobileOtpDto } from "../auth/dto/request-mobile-otp.dto";
import { RevokeSessionDto } from "../auth/dto/revoke-session.dto";
import { VerifyMobileOtpDto } from "../auth/dto/verify-mobile-otp.dto";

import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/verification/resend")
  resendVerificationEmail(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.resendVerificationEmail(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/password/change")
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      user.id,
      changePasswordDto,
      user.sessionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/mobile-otp/request")
  requestMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() requestMobileOtpDto: RequestMobileOtpDto,
  ) {
    return this.usersService.requestMobileOtp(user.id, requestMobileOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/mobile-otp/verify")
  verifyMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyMobileOtpDto: VerifyMobileOtpDto,
  ) {
    return this.usersService.verifyMobileOtp(user.id, verifyMobileOtpDto);
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
