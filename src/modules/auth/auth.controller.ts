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
import { getClientIpAddress } from "../../common/utils/request-source.util";

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

type RequestLike = {
  ip?: string;
  headers?: { [key: string]: string | string[] | undefined };
  socket?: { remoteAddress?: string };
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Post("signup")
  signup(
    @Body() signupDto: SignupDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.signup(
      signupDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("login")
  login(
    @Body() loginDto: LoginDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.login(
      loginDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.requestPasswordReset(
      forgotPasswordDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("reset-password")
  @HttpCode(200)
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.resetPassword(
      resetPasswordDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("verify-email")
  verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.verifyEmail(
      verifyEmailDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("verify-email/resend")
  @HttpCode(200)
  resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.resendVerificationEmail(
      resendVerificationEmailDto,
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto,
      user.sessionId,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mobile-otp/request")
  @HttpCode(200)
  requestMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() requestMobileOtpDto: RequestMobileOtpDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.requestMobileOtp(
      user.id,
      requestMobileOtpDto,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("mobile-otp/verify")
  @HttpCode(200)
  verifyMobileOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyMobileOtpDto: VerifyMobileOtpDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.authService.verifyMobileOtp(
      user.id,
      verifyMobileOtpDto,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/current")
  revokeCurrentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.authService.revokeCurrentSession(user.id, user.sessionId ?? "", {
      requestId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/others")
  revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.authService.revokeOtherSessions(user.id, user.sessionId ?? "", {
      requestId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions")
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() revokeSessionDto: RevokeSessionDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    return this.authService.revokeSession(
      user.id,
      user.sessionId ?? "",
      revokeSessionDto,
      { requestId },
    );
  }
}
