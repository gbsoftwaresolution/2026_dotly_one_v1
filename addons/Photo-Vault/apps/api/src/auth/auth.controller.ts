import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService, AuthSession, AuthUser } from "./auth.service";
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  ChangePasswordDto,
  VerifyPasswordDto,
} from "@booster-vault/shared";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";

@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest,
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    return this.authService.register(registerDto, req);
  }

  @Post("login")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    return this.authService.login(loginDto, req);
  }

  @Post("refresh")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto: RefreshDto,
    @Request() req: ExpressRequest,
  ): Promise<AuthSession> {
    return this.authService.refresh(refreshDto.refreshToken, req);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() refreshDto: RefreshDto): Promise<void> {
    await this.authService.logout(refreshDto.refreshToken);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Request() req: ExpressRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.authService.changePassword(userId, changePasswordDto);
  }

  /**
   * Verify the current account password for the authenticated user.
   * This is used for sensitive client flows (e.g., first-time vault setup confirmation).
   */
  @Post("verify-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPassword(
    @Request() req: ExpressRequest,
    @Body() dto: VerifyPasswordDto,
  ): Promise<{ valid: boolean }> {
    const userId = (req as any).user?.sub;
    const valid = await this.authService.verifyPassword(userId, dto.password);
    return { valid };
  }

  @Post("request-email-verification")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestEmailVerification(@Body("email") email: string): Promise<void> {
    await this.authService.requestEmailVerification(email);
  }

  @Post("verify-email")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body("token") token: string): Promise<void> {
    await this.authService.verifyEmail(token);
  }

  @Post("forgot-password")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body("email") email: string): Promise<void> {
    await this.authService.forgotPassword(email);
  }

  @Post("reset-password")
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Request() req: ExpressRequest,
    @Body("token") token: string,
    @Body("newPassword") newPassword: string,
  ): Promise<void> {
    const requestId = (req as any).requestId as string | undefined;
    await this.authService.resetPassword(token, newPassword, requestId);
  }
}
