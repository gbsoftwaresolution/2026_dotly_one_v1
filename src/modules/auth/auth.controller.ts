import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
import { FinishPasskeyAuthenticationDto } from "./dto/finish-passkey-authentication.dto";
import { FinishPasskeyRegistrationDto } from "./dto/finish-passkey-registration.dto";
import { LoginDto } from "./dto/login.dto";
import { PasskeyIdParamDto } from "./dto/passkey-id-param.dto";
import { RenamePasskeyDto } from "./dto/rename-passkey.dto";
import { RequestMobileOtpDto } from "./dto/request-mobile-otp.dto";
import { ResendVerificationEmailDto } from "./dto/resend-verification-email.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RevokeSessionDto } from "./dto/revoke-session.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { VerifyMobileOtpDto } from "./dto/verify-mobile-otp.dto";

import { AuthService } from "./auth.service";
import { PasskeysService } from "./passkeys.service";

type RequestLike = {
  ip?: string;
  headers?: { [key: string]: string | string[] | undefined };
  socket?: { remoteAddress?: string };
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passkeysService: PasskeysService,
  ) {}

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

  @Post("passkeys/authentication/start")
  startPasskeyAuthentication(
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.passkeysService.startAuthentication(
      this.buildRequestContext(requestId, userAgent, request),
    );
  }

  @Post("passkeys/authentication/finish")
  finishPasskeyAuthentication(
    @Body() body: FinishPasskeyAuthenticationDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.passkeysService.finishAuthentication(
      body.response as any,
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
  @Post("passkeys/registration/start")
  startPasskeyRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.passkeysService.startRegistration(
      user.id,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("passkeys/registration/finish")
  finishPasskeyRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: FinishPasskeyRegistrationDto,
    @Headers("x-request-id") requestId?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() request?: RequestLike,
  ) {
    return this.passkeysService.finishRegistration(
      user.id,
      body.response as any,
      body.name,
      this.buildRequestContext(requestId, userAgent, request, user.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("passkeys")
  listPasskeys(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeysService.listPasskeys(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("passkeys/:passkeyId")
  renamePasskey(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: PasskeyIdParamDto,
    @Body() body: RenamePasskeyDto,
  ) {
    return this.passkeysService.renamePasskey(
      user.id,
      params.passkeyId,
      body.name,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete("passkeys/:passkeyId")
  deletePasskey(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: PasskeyIdParamDto,
  ) {
    return this.passkeysService.deletePasskey(user.id, params.passkeyId);
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
    return this.authService.revokeCurrentSession(
      user.id,
      user.sessionId ?? "",
      {
        requestId,
      },
    );
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
