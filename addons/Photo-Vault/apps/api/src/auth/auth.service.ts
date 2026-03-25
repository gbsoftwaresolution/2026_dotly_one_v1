import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";
import { TokensService } from "./tokens.service";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "../config/config.service";
import { AuditEventType } from "../audit/audit-event-types";
import { Request } from "express";
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
} from "@booster-vault/shared";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  displayName?: string | null;
  locale: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly sessionsService: SessionsService,
    private readonly tokensService: TokensService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(
    registerDto: RegisterDto,
    request: Request,
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    const { email, password, displayName, locale, timezone } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(password);

    // Create user with transaction to also create subscription and usage records
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          displayName,
          locale: locale || "en",
          timezone: timezone || "Asia/Kolkata",
          isEmailVerified: false,
        },
      });

      // Create default subscription (TRIAL)
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      await tx.subscription.create({
        data: {
          userId: newUser.id,
          status: "TRIAL",
          plan: "P6M_25",
          trialStartedAt: new Date(),
          trialEndsAt,
          trialMediaLimit: 50,
        },
      });

      // Create usage record
      await tx.userUsage.create({
        data: {
          userId: newUser.id,
          totalMediaCount: 0,
          totalPhotoCount: 0,
          totalVideoCount: 0,
          trashedMediaCount: 0,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId: newUser.id,
          eventType: "USER_REGISTERED",
          entityType: "USER",
          entityId: newUser.id,
          meta: { email: newUser.email },
        },
      });

      return newUser;
    });

    // Create session
    const { sessionId, refreshToken } =
      await this.sessionsService.createSession(user.id, request);
    const { accessToken, expiresIn } = await this.generateAccessToken(
      user.id,
      sessionId,
    );

    // Send email verification (but don't block registration)
    try {
      await this.sendVerificationEmail(user.id, user.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send verification email to ${user.email}: ${message}`,
      );
    }

    return {
      user: this.mapUserToAuthUser(user),
      session: {
        accessToken,
        refreshToken,
        expiresIn,
      },
    };
  }

  /**
   * Login user
   */
  async login(
    loginDto: LoginDto,
    request: Request,
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists for security
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const isValid = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Create session
    const { sessionId, refreshToken } =
      await this.sessionsService.createSession(user.id, request);
    const { accessToken, expiresIn } = await this.generateAccessToken(
      user.id,
      sessionId,
    );

    // Update last seen timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        eventType: "USER_LOGGED_IN",
        entityType: "USER",
        entityId: user.id,
        meta: { email: user.email },
      },
    });

    return {
      user: this.mapUserToAuthUser(user),
      session: {
        accessToken,
        refreshToken,
        expiresIn,
      },
    };
  }

  /**
   * Verify the current password for an authenticated user.
   * Returns true/false without revealing additional info.
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return false;
    }

    return this.passwordService.verifyPassword(password, user.passwordHash);
  }

  /**
   * Refresh tokens
   */
  async refresh(refreshToken: string, request: Request): Promise<AuthSession> {
    const { sessionId, refreshToken: newRefreshToken } =
      await this.sessionsService.rotateRefreshToken(refreshToken, request);

    const { session } =
      await this.sessionsService.validateRefreshToken(newRefreshToken);
    const { accessToken, expiresIn } = await this.generateAccessToken(
      session.userId,
      sessionId,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.sessionsService.revokeRefreshToken(refreshToken);
  }

  /**
   * Request email verification
   */
  async requestEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return;
    }

    if (user.isEmailVerified) {
      return;
    }

    await this.sendVerificationEmail(user.id, user.email);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokensService.validateAndConsumeToken(
      token,
      "EMAIL_VERIFICATION",
    );

    if (!userId) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isEmailVerified) {
      return; // Already verified
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "EMAIL_VERIFIED",
        entityType: "USER",
        entityId: userId,
      },
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return;
    }

    await this.sendPasswordResetEmail(user.id, user.email);
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    requestId?: string,
  ): Promise<void> {
    const userId = await this.tokensService.validateAndConsumeToken(
      token,
      "PASSWORD_RESET",
    );

    if (!userId) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Hash new password
    const passwordHash = await this.passwordService.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    // Revoke all user sessions (force logout everywhere)
    await this.sessionsService.revokeAllUserSessions(userId);

    // If recovery is disabled but the user previously accepted the risk, log for internal visibility.
    const recoveryBundle = await this.prisma.recoveryBundle.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!recoveryBundle && user.acceptedVaultRecoveryRiskAt) {
      await this.prisma.auditEvent.create({
        data: {
          userId,
          eventType: AuditEventType.PASSWORD_RESET_WITHOUT_RECOVERY,
          entityType: "USER",
          entityId: userId,
          meta: {
            requestId,
          },
        },
      });
    }

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "PASSWORD_RESET",
        entityType: "USER",
        entityId: userId,
        meta: {
          requestId,
        },
      },
    });
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify current password
    const isValid = await this.passwordService.verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash new password
    const passwordHash = await this.passwordService.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    // Revoke all user sessions except current session (optional)
    // For security, we'll revoke all sessions (force logout everywhere)
    await this.sessionsService.revokeAllUserSessions(userId);

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "PASSWORD_CHANGED",
        entityType: "USER",
        entityId: userId,
      },
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.mapUserToAuthUser(user);
  }

  /**
   * Update user profile (non-sensitive fields)
   */
  async updateProfile(
    userId: string,
    updates: { displayName?: string; locale?: string; timezone?: string },
  ): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName:
          updates.displayName !== undefined
            ? updates.displayName
            : user.displayName,
        locale: updates.locale || user.locale,
        timezone: updates.timezone || user.timezone,
        updatedAt: new Date(),
      },
    });

    return this.mapUserToAuthUser(updatedUser);
  }

  /**
   * Generate access token JWT
   */
  private async generateAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isEmailVerified: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      sessionId,
      isEmailVerified: user.isEmailVerified,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    // Parse expiresIn from JWT config
    const expiresIn = this.parseExpiresIn(
      this.configService.jwtAccessExpiresIn,
    );

    return { accessToken, expiresIn };
  }

  /**
   * Parse expiresIn string (e.g., "15m", "1h", "7d") to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60; // Default 15 minutes in seconds
    }

    const value = match[1];
    const unit = match[2];
    if (!value || !unit) {
      return 15 * 60;
    }

    const numValue = parseInt(value, 10);

    switch (unit) {
      case "s":
        return numValue;
      case "m":
        return numValue * 60;
      case "h":
        return numValue * 60 * 60;
      case "d":
        return numValue * 24 * 60 * 60;
      default:
        return 15 * 60;
    }
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    // Invalidate any existing verification tokens
    await this.tokensService.invalidateAllTokens(userId, "EMAIL_VERIFICATION");

    // Create new verification token (expires in 24 hours)
    const { rawToken } = await this.tokensService.createToken(
      userId,
      "EMAIL_VERIFICATION",
      24,
    );

    // Build verification URL
    const webAppUrl = this.configService.webAppUrl;
    const verificationSuccessPath = this.configService.get(
      "VERIFICATION_SUCCESS_PATH",
      "/verify-email",
    );

    const verificationUrl = `${webAppUrl}${verificationSuccessPath}?token=${encodeURIComponent(rawToken)}`;

    // Send email
    await this.mailService.sendVerificationEmail(email, verificationUrl);
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    // Invalidate any existing reset tokens
    await this.tokensService.invalidateAllTokens(userId, "PASSWORD_RESET");

    // Create new reset token (expires in 1 hour)
    const { rawToken } = await this.tokensService.createToken(
      userId,
      "PASSWORD_RESET",
      1,
    );

    // Build reset URL
    const webAppUrl = this.configService.webAppUrl;
    const passwordResetPath = this.configService.get(
      "PASSWORD_RESET_PATH",
      "/reset-password",
    );

    const resetUrl = `${webAppUrl}${passwordResetPath}?token=${encodeURIComponent(rawToken)}`;

    // Send email
    await this.mailService.sendPasswordResetEmail(email, resetUrl);
  }

  /**
   * Map Prisma user to AuthUser
   */
  private mapUserToAuthUser(user: any): AuthUser {
    return {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      displayName: user.displayName,
      locale: user.locale,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
