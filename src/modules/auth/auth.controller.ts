import {
  Body,
  Controller,
  Delete,
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

import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestMobileOtpDto } from "./dto/request-mobile-otp.dto";
import { ResendVerificationEmailDto } from "./dto/resend-verification-email.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RevokeSessionDto } from "./dto/revoke-session.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerifyMobileOtpDto } from "./dto/verify-mobile-otp.dto";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post("login")
  login(
    @Body() loginDto: LoginDto,
    @Headers("user-agent") userAgent?: string,
    @Req()
    request?: {
      ip?: string;
      headers?: { [key: string]: string | string[] | undefined };
      socket?: { remoteAddress?: string };
    },
  ) {
    return this.authService.login(loginDto, {
      userAgent,
      ipAddress:
        request?.ip ??
        request?.socket?.remoteAddress ??
        (typeof request?.headers?.["x-forwarded-for"] === "string"
          ? request.headers["x-forwarded-for"].split(",")[0]?.trim()
          : null),
    });
  }

  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post("reset-password")
  @HttpCode(200)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post("verify-email")
  verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post("verify-email/resend")
  resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    return this.authService.resendVerificationEmail(resendVerificationEmailDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto,
      user.sessionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mobile-otp/request")
  requestMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() requestMobileOtpDto: RequestMobileOtpDto,
  ) {
    return this.authService.requestMobileOtp(user.id, requestMobileOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("mobile-otp/verify")
  verifyMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyMobileOtpDto: VerifyMobileOtpDto,
  ) {
    return this.authService.verifyMobileOtp(user.id, verifyMobileOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/current")
  revokeCurrentSession(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeCurrentSession(user.id, user.sessionId ?? "");
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/others")
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeOtherSessions(user.id, user.sessionId ?? "");
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions")
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() revokeSessionDto: RevokeSessionDto,
  ) {
    return this.authService.revokeSession(
      user.id,
      user.sessionId ?? "",
      revokeSessionDto,
    );
  }
}
