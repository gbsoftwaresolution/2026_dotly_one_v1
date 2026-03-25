import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { UsersService, UserSubscription, UserUsage } from "./users.service";
import { AuthUser } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import { IsOptional, IsString, IsIn } from "class-validator";

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsIn(["en", "fr", "de", "es", "pt", "hi", "ja", "ko", "zh"]) // Common locales
  locale?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
  ]) // Common timezones
  timezone?: string;
}

@Controller("me")
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get()
  async getCurrentUser(
    @Request() req: ExpressRequest,
  ): Promise<{ user: AuthUser }> {
    const userId = (req as any).user?.sub;
    const user = await this.usersService.getCurrentUser(userId);
    return { user };
  }

  /**
   * Update user profile (non-sensitive fields)
   */
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: ExpressRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<{ user: AuthUser }> {
    const userId = (req as any).user?.sub;
    const user = await this.usersService.updateProfile(
      userId,
      updateProfileDto,
    );
    return { user };
  }

  /**
   * Get user's subscription
   */
  @Get("subscription")
  async getSubscription(
    @Request() req: ExpressRequest,
  ): Promise<{ subscription: UserSubscription }> {
    const userId = (req as any).user?.sub;
    const subscription = await this.usersService.getSubscription(userId);
    return { subscription };
  }

  /**
   * Get user's usage statistics
   */
  @Get("usage")
  async getUsage(
    @Request() req: ExpressRequest,
  ): Promise<{ usage: UserUsage }> {
    const userId = (req as any).user?.sub;
    const usage = await this.usersService.getUsage(userId);
    return { usage };
  }

  /**
   * Get user's active sessions (optional endpoint)
   */
  @Get("sessions")
  async getSessions(
    @Request() req: ExpressRequest,
  ): Promise<{ sessions: any[] }> {
    const userId = (req as any).user?.sub;
    const sessions = await this.usersService.getSessions(userId);
    return { sessions };
  }
}
