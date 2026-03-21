import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt } from "node:crypto";

import { MailService } from "../../infrastructure/mail/mail.service";
import { CacheService } from "../../infrastructure/cache/cache.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";
import { SmsService } from "../../infrastructure/sms/sms.service";
import { AnalyticsService } from "../analytics/analytics.service";

import { DeviceSessionService } from "./device-session.service";
import { PasswordPolicyService } from "./password-policy.service";
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

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_RESEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_LIMIT = 5;
const INVALID_VERIFICATION_MESSAGE = "Verification link is invalid or expired";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_WINDOW_LIMIT = 5;
const INVALID_RESET_MESSAGE = "Reset link is invalid or expired";
const PASSWORD_RESET_GENERIC_RESPONSE = {
  accepted: true,
  resetEmailSent: true,
};

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_WINDOW_LIMIT = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_ATTEMPT_COOLDOWN_MS = 5 * 1000;
const MOBILE_OTP_ENROLLMENT_PURPOSE = "ENROLLMENT" as const;

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly analyticsService: AnalyticsService,
    @Optional()
    private readonly passwordPolicyService: PasswordPolicyService = new PasswordPolicyService(),
    @Optional()
    private readonly deviceSessionService: DeviceSessionService = {
      createSession: async () => ({
        id: "session-test",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      listSessions: async () => [],
      revokeSession: async () => true,
      revokeOtherSessions: async () => 0,
      revokeAllSessions: async () => 0,
    } as unknown as DeviceSessionService,
    @Optional()
    private readonly smsService: SmsService = {
      isConfigured: () => false,
      sendOtp: async () => false,
    } as unknown as SmsService,
    @Optional()
    private readonly cacheService: CacheService = {
      increment: async () => null,
      setIfAbsent: async () => null,
    } as unknown as CacheService,
    @Optional()
    private readonly configService: ConfigService = {
      get: (_key: string, fallback?: string) => fallback,
    } as ConfigService,
    @Optional()
    private readonly logger: AppLoggerService = {
      logWithMeta: () => undefined,
    } as unknown as AppLoggerService,
  ) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async signup(signupDto: SignupDto) {
    this.passwordPolicyService.validate(signupDto.password);

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: signupDto.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: signupDto.email,
          passwordHash,
          isVerified: false,
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
          phoneNumber: true,
          pendingPhoneNumber: true,
          phoneVerifiedAt: true,
        },
      });

      const verification = await this.issueEmailVerificationToken(
        user.id,
        user.email,
      );

      return {
        user,
        verificationPending: true,
        verificationEmailSent: verification.emailSent,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email already in use");
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto, context?: SessionContext) {
    const normalizedEmail = this.normalizeEmailAddress(loginDto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isVerified: true,
      },
    });

    if (!user) {
      this.logSecurityEvent("warn", "Login rejected", {
        outcome: "unknown_email",
        emailHash: this.hashSecurityIdentifier(normalizedEmail),
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      this.logSecurityEvent("warn", "Login rejected", {
        outcome: "invalid_password",
        actorUserId: user.id,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const expiresAt = this.getSessionExpiryDate();
    const session = await this.deviceSessionService.createSession(
      user.id,
      expiresAt,
      context,
    );

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
    });

    this.logSecurityEvent("log", "Login completed", {
      actorUserId: user.id,
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
      hasUserAgent: Boolean(context?.userAgent),
      hasIpAddress: Boolean(context?.ipAddress),
    });

    return {
      accessToken,
      sessionId: session.id,
      expiresAt,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const tokenHash = this.hashVerificationToken(verifyEmailDto.token);
    const now = new Date();
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isVerified: true,
            phoneNumber: true,
            pendingPhoneNumber: true,
            phoneVerifiedAt: true,
          },
        },
      },
    });

    if (!token) {
      throw new BadRequestException(INVALID_VERIFICATION_MESSAGE);
    }

    if (token.user.isVerified) {
      if (!token.consumedAt) {
        await this.prisma.emailVerificationToken.update({
          where: {
            id: token.id,
          },
          data: {
            consumedAt: now,
          },
        });
      }

      return {
        verified: true,
        alreadyVerified: true,
        user: token.user,
      };
    }

    if (
      token.consumedAt ||
      token.supersededAt ||
      token.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BadRequestException(INVALID_VERIFICATION_MESSAGE);
    }

    const user = await this.prismaService.$transaction(async (tx: any) => {
      const verifiedUser = await tx.user.update({
        where: {
          id: token.userId,
        },
        data: {
          isVerified: true,
        },
        select: {
          id: true,
          email: true,
          isVerified: true,
          phoneNumber: true,
          pendingPhoneNumber: true,
          phoneVerifiedAt: true,
        },
      });

      await tx.emailVerificationToken.update({
        where: {
          id: token.id,
        },
        data: {
          consumedAt: now,
        },
      });

      await tx.emailVerificationToken.updateMany({
        where: {
          userId: token.userId,
          id: {
            not: token.id,
          },
          consumedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: now,
        },
      });

      return verifiedUser;
    });

    await this.analyticsService.trackEmailVerified({
      actorUserId: user.id,
    });

    return {
      verified: true,
      alreadyVerified: false,
      user,
    };
  }

  async resendVerificationEmail(
    resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    const normalizedEmail = this.normalizeEmailAddress(
      resendVerificationEmailDto.email,
    );
    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
        isVerified: true,
      },
    });

    if (!user || user.isVerified) {
      this.logSecurityEvent("log", "Verification resend accepted without issuance", {
        outcome: user ? "already_verified" : "unknown_email",
        actorUserId: user?.id,
        emailHash: this.hashSecurityIdentifier(normalizedEmail),
      });
      return {
        accepted: true,
        verificationPending: false,
        verificationEmailSent: false,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
      };
    }

    await this.assertCanResendVerificationEmail(user.id);

    const verification = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      "resend",
    );

    await this.analyticsService.trackVerificationResend({
      actorUserId: user.id,
      emailSent: verification.emailSent,
    });

    this.logSecurityEvent("log", "Verification resend issued", {
      actorUserId: user.id,
      emailSent: verification.emailSent,
      expiresAt: verification.expiresAt.toISOString(),
    });

    return {
      accepted: true,
      verificationPending: true,
      verificationEmailSent: verification.emailSent,
      mailDeliveryAvailable:
        (this.mailService as any).isEmailVerificationConfigured?.() ??
        this.mailService.isConfigured(),
    };
  }

  async resendVerificationEmailForCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid authentication token");
    }

    if (user.isVerified) {
      this.logSecurityEvent("log", "Verification resend accepted without issuance", {
        outcome: "already_verified",
        actorUserId: user.id,
      });
      return {
        accepted: true,
        verificationPending: false,
        verificationEmailSent: false,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
      };
    }

    await this.assertCanResendVerificationEmail(user.id);

    const verification = await this.issueEmailVerificationToken(
      user.id,
      user.email,
      "resend",
    );

    await this.analyticsService.trackVerificationResend({
      actorUserId: user.id,
      emailSent: verification.emailSent,
    });

    this.logSecurityEvent("log", "Verification resend issued", {
      actorUserId: user.id,
      emailSent: verification.emailSent,
      expiresAt: verification.expiresAt.toISOString(),
    });

    return {
      accepted: true,
      verificationPending: true,
      verificationEmailSent: verification.emailSent,
      mailDeliveryAvailable:
        (this.mailService as any).isEmailVerificationConfigured?.() ??
        this.mailService.isConfigured(),
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    currentSessionId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid authentication token");
    }

    const currentPasswordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      this.logSecurityEvent("warn", "Password change rejected", {
        actorUserId: userId,
        outcome: "incorrect_current_password",
      });
      throw new BadRequestException("Current password is incorrect.");
    }

    this.passwordPolicyService.validate(changePasswordDto.newPassword, {
      currentPassword: changePasswordDto.currentPassword,
    });

    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        consumedAt: null,
        supersededAt: null,
      },
      data: {
        supersededAt: new Date(),
      },
    });

    if (currentSessionId) {
      await this.deviceSessionService.revokeOtherSessions(
        userId,
        currentSessionId,
        "password_changed",
      );
    } else {
      await this.deviceSessionService.revokeAllSessions(
        userId,
        "password_changed",
      );
    }

    this.logSecurityEvent("log", "Password changed", {
      actorUserId: userId,
      retainedCurrentSession: Boolean(currentSessionId),
    });

    return {
      success: true,
      signedOutSessions: true,
    };
  }

  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = this.normalizeEmailAddress(forgotPasswordDto.email);

    await this.assertAnonymousPasswordResetAllowed(normalizedEmail);

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      this.logSecurityEvent("log", "Password reset request accepted without issuance", {
        outcome: "unknown_email",
        emailHash: this.hashSecurityIdentifier(normalizedEmail),
      });
      return PASSWORD_RESET_GENERIC_RESPONSE;
    }

    const canIssuePasswordReset = await this.canIssuePasswordReset(user.id);

    if (!canIssuePasswordReset) {
      this.logSecurityEvent("warn", "Password reset request suppressed", {
        actorUserId: user.id,
        outcome: "per_account_rate_limited",
      });
      return PASSWORD_RESET_GENERIC_RESPONSE;
    }

    await this.issuePasswordResetToken(user.id, user.email);

    this.logSecurityEvent("log", "Password reset token issued", {
      actorUserId: user.id,
      emailHash: this.hashSecurityIdentifier(normalizedEmail),
    });

    return PASSWORD_RESET_GENERIC_RESPONSE;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const now = new Date();
    const tokenHash = this.hashVerificationToken(resetPasswordDto.token);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            passwordHash: true,
          },
        },
      },
    });

    if (
      !token ||
      token.consumedAt ||
      token.supersededAt ||
      token.expiresAt.getTime() <= now.getTime()
    ) {
      this.logSecurityEvent("warn", "Password reset rejected", {
        outcome: "invalid_or_expired_token",
      });
      throw new BadRequestException(INVALID_RESET_MESSAGE);
    }

    this.passwordPolicyService.validate(resetPasswordDto.password);

    const alreadyUsed = await bcrypt.compare(
      resetPasswordDto.password,
      token.user.passwordHash,
    );

    if (alreadyUsed) {
      this.logSecurityEvent("warn", "Password reset rejected", {
        actorUserId: token.userId,
        outcome: "password_reuse",
      });
      throw new BadRequestException(
        "Choose a new password that is different from your current one.",
      );
    }

    const passwordHash = await bcrypt.hash(resetPasswordDto.password, 10);

    await this.prismaService.$transaction(async (tx: any) => {
      await tx.user.update({
        where: {
          id: token.userId,
        },
        data: {
          passwordHash,
        },
        select: {
          id: true,
        },
      });

      await tx.passwordResetToken.update({
        where: {
          id: token.id,
        },
        data: {
          consumedAt: now,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: token.userId,
          id: {
            not: token.id,
          },
          consumedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: now,
        },
      });
    });

    await this.deviceSessionService.revokeAllSessions(
      token.userId,
      "password_reset",
    );

    this.logSecurityEvent("log", "Password reset completed", {
      actorUserId: token.userId,
      revokedAllSessions: true,
    });

    return {
      success: true,
      signedOutSessions: true,
    };
  }

  async requestMobileOtp(
    userId: string,
    requestMobileOtpDto: RequestMobileOtpDto,
  ) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(
      requestMobileOtpDto.phoneNumber,
    );

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid authentication token");
    }

    const conflictingUser = await this.prisma.user.findFirst({
      where: {
        phoneNumber: normalizedPhoneNumber,
        id: {
          not: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (conflictingUser) {
      this.logSecurityEvent("warn", "Mobile OTP request rejected", {
        actorUserId: userId,
        outcome: "phone_already_verified_elsewhere",
      });
      throw new ConflictException(
        "That mobile number is already verified on another Dotly account.",
      );
    }

    await this.assertCanIssueMobileOtp(userId);

    const issued = await this.issueMobileOtp(userId, normalizedPhoneNumber);

    this.logSecurityEvent("log", "Mobile OTP issued", {
      actorUserId: userId,
      phoneNumberMasked: this.maskPhoneNumber(normalizedPhoneNumber),
      deliveryAvailable: this.smsService.isConfigured(),
      challengeId: issued.challengeId,
      expiresAt: issued.expiresAt.toISOString(),
    });

    return {
      status: "sent",
      challengeId: issued.challengeId,
      purpose: issued.purpose,
      phoneNumber: this.maskPhoneNumber(normalizedPhoneNumber),
      resendAvailableAt: issued.resendAvailableAt,
      expiresAt: issued.expiresAt,
      deliveryAvailable: this.smsService.isConfigured(),
    };
  }

  async verifyMobileOtp(
    userId: string,
    verifyMobileOtpDto: VerifyMobileOtpDto,
  ) {
    const now = new Date();
    const challengeId = this.normalizeOpaqueToken(
      verifyMobileOtpDto.challengeId,
    );
    const codeHash = this.hashVerificationToken(verifyMobileOtpDto.code);
    const challenge = await this.prisma.mobileOtpChallenge.findFirst({
      where: {
        userId,
        id: challengeId,
        purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
      },
      select: {
        id: true,
        phoneNumber: true,
        codeHash: true,
        expiresAt: true,
        consumedAt: true,
        supersededAt: true,
        invalidAttemptCount: true,
        lastAttemptAt: true,
      },
    });

    if (!challenge) {
      this.logSecurityEvent("warn", "Mobile OTP verification rejected", {
        actorUserId: userId,
        outcome: "challenge_not_found",
      });
      throw new BadRequestException(
        "Request a verification code before trying again.",
      );
    }

    if (challenge.consumedAt || challenge.supersededAt) {
      this.logSecurityEvent("warn", "Mobile OTP verification rejected", {
        actorUserId: userId,
        challengeId: challenge.id,
        outcome: "inactive_challenge",
      });
      throw new BadRequestException(
        "This code is no longer active. Request a new one.",
      );
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      this.logSecurityEvent("warn", "Mobile OTP verification rejected", {
        actorUserId: userId,
        challengeId: challenge.id,
        outcome: "expired_challenge",
      });
      throw new BadRequestException("This code expired. Request a new one.");
    }

    if (challenge.invalidAttemptCount >= OTP_MAX_ATTEMPTS) {
      this.logSecurityEvent("warn", "Mobile OTP verification rate limited", {
        actorUserId: userId,
        challengeId: challenge.id,
        outcome: "attempt_limit_reached",
      });
      throw new HttpException(
        "Too many incorrect codes. Request a new one.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      challenge.lastAttemptAt &&
      now.getTime() - challenge.lastAttemptAt.getTime() < OTP_ATTEMPT_COOLDOWN_MS
    ) {
      this.logSecurityEvent("warn", "Mobile OTP verification rate limited", {
        actorUserId: userId,
        challengeId: challenge.id,
        outcome: "attempt_cooldown_active",
      });
      throw new HttpException(
        "Please wait a moment before trying another verification code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (challenge.codeHash !== codeHash) {
      const nextInvalidAttemptCount = challenge.invalidAttemptCount + 1;

      await this.prisma.mobileOtpChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          invalidAttemptCount: nextInvalidAttemptCount,
          lastAttemptAt: now,
          ...(nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS
            ? { supersededAt: now }
            : {}),
        },
        select: {
          id: true,
        },
      });

      this.logSecurityEvent("warn", "Mobile OTP verification rejected", {
        actorUserId: userId,
        challengeId: challenge.id,
        outcome:
          nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS
            ? "attempt_limit_reached"
            : "invalid_code",
        invalidAttemptCount: nextInvalidAttemptCount,
      });

      if (nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS) {
        throw new HttpException(
          "Too many incorrect codes. Request a new one.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException("The code you entered is invalid.");
    }

    await this.prismaService.$transaction(async (tx: any) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          phoneNumber: challenge.phoneNumber,
          pendingPhoneNumber: null,
          phoneVerifiedAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.mobileOtpChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          consumedAt: now,
          lastAttemptAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.mobileOtpChallenge.updateMany({
        where: {
          userId,
          purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
          id: {
            not: challenge.id,
          },
          consumedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: now,
        },
      });
    });

    this.logSecurityEvent("log", "Mobile OTP verified", {
      actorUserId: userId,
      challengeId: challenge.id,
      phoneNumberMasked: this.maskPhoneNumber(challenge.phoneNumber),
    });

    return {
      verified: true,
      phoneNumber: this.maskPhoneNumber(challenge.phoneNumber),
      verifiedAt: now,
    };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.deviceSessionService.listSessions(userId);

    return {
      sessions: sessions.map((session: any) => ({
        id: session.id,
        deviceLabel: session.deviceLabel,
        platformLabel: session.platformLabel,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === currentSessionId,
      })),
    };
  }

  async revokeSession(
    userId: string,
    currentSessionId: string,
    dto: RevokeSessionDto,
  ) {
    const trackedCurrentSessionId = this.assertTrackedCurrentSessionId(
      currentSessionId,
    );
    const requestedSessionId = this.normalizeOpaqueToken(dto.sessionId);

    if (requestedSessionId === trackedCurrentSessionId) {
      throw new BadRequestException(
        "Use sign out if you want to leave the current device.",
      );
    }

    const revoked = await this.deviceSessionService.revokeSession(
      userId,
      requestedSessionId,
      "remote_sign_out",
    );

    if (!revoked) {
      this.logSecurityEvent("warn", "Session revoke rejected", {
        actorUserId: userId,
        currentSessionId: trackedCurrentSessionId,
        targetSessionId: requestedSessionId,
        outcome: "session_not_found",
      });
      throw new NotFoundException("Session not found.");
    }

    this.logSecurityEvent("log", "Session revoked", {
      actorUserId: userId,
      currentSessionId: trackedCurrentSessionId,
      targetSessionId: requestedSessionId,
      reason: "remote_sign_out",
    });

    return {
      success: true,
    };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const trackedCurrentSessionId = this.assertTrackedCurrentSessionId(
      currentSessionId,
    );
    const revokedCount = await this.deviceSessionService.revokeOtherSessions(
      userId,
      trackedCurrentSessionId,
      "sign_out_other_sessions",
    );

    this.logSecurityEvent("log", "Other sessions revoked", {
      actorUserId: userId,
      currentSessionId: trackedCurrentSessionId,
      revokedCount,
      reason: "sign_out_other_sessions",
    });

    return {
      success: true,
      revokedCount,
    };
  }

  async revokeCurrentSession(userId: string, currentSessionId: string) {
    const trackedCurrentSessionId = this.assertTrackedCurrentSessionId(
      currentSessionId,
    );
    await this.deviceSessionService.revokeSession(
      userId,
      trackedCurrentSessionId,
      "logout",
    );

    this.logSecurityEvent("log", "Current session revoked", {
      actorUserId: userId,
      currentSessionId: trackedCurrentSessionId,
      reason: "logout",
    });

    return {
      success: true,
    };
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    context: "signup" | "resend" = "signup",
  ) {
    const now = new Date();
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);

    await this.prismaService.$transaction(async (tx: any) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId,
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          supersededAt: now,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    const emailSent = await this.mailService.sendEmailVerification({
      to: email,
      token: rawToken,
      expiresAt,
    });

    await this.analyticsService.trackVerificationEmailIssued({
      actorUserId: userId,
      context,
      emailSent,
    });

    return {
      emailSent,
      expiresAt,
    };
  }

  private async issuePasswordResetToken(userId: string, email: string) {
    const now = new Date();
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

    await this.prismaService.$transaction(async (tx: any) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId,
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          supersededAt: now,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    const emailSent = await this.mailService.sendPasswordReset({
      to: email,
      token: rawToken,
      expiresAt,
    });

    return {
      emailSent,
      expiresAt,
    };
  }

  private async issueMobileOtp(userId: string, phoneNumber: string) {
    const now = new Date();
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
    const createdChallenge = await this.prismaService.$transaction(async (tx: any) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          pendingPhoneNumber: phoneNumber,
        },
        select: {
          id: true,
        },
      });

      await tx.mobileOtpChallenge.updateMany({
        where: {
          userId,
          purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          supersededAt: now,
        },
      });

      return tx.mobileOtpChallenge.create({
        data: {
          userId,
          phoneNumber,
          purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
          codeHash: this.hashVerificationToken(code),
          expiresAt,
          resendAvailableAt,
        },
        select: {
          id: true,
          purpose: true,
        },
      }) as Promise<{
        id: string;
        purpose: string;
      }>;
    });

    await this.smsService.sendOtp({
      to: phoneNumber,
      code,
      expiresInMinutes: Math.round(OTP_TTL_MS / (60 * 1000)),
    });

    return {
      challengeId: createdChallenge.id,
      purpose: createdChallenge.purpose,
      expiresAt,
      resendAvailableAt,
    };
  }

  private async assertCanResendVerificationEmail(userId: string) {
    const now = new Date();
    const lastIssuedToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (
      lastIssuedToken &&
      now.getTime() - lastIssuedToken.createdAt.getTime() <
        EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        "Please wait before requesting another verification email",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const recentIssueCount = await this.prisma.emailVerificationToken.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(now.getTime() - EMAIL_VERIFICATION_RESEND_WINDOW_MS),
        },
      },
    });

    if (recentIssueCount >= EMAIL_VERIFICATION_RESEND_LIMIT) {
      throw new HttpException(
        "Too many verification emails requested. Please try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async canIssuePasswordReset(userId: string) {
    const now = new Date();
    const lastIssuedToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (
      lastIssuedToken &&
      now.getTime() - lastIssuedToken.createdAt.getTime() <
        PASSWORD_RESET_COOLDOWN_MS
    ) {
      return false;
    }

    const recentIssueCount = await this.prisma.passwordResetToken.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(now.getTime() - PASSWORD_RESET_WINDOW_MS),
        },
      },
    });

    if (recentIssueCount >= PASSWORD_RESET_WINDOW_LIMIT) {
      return false;
    }

    return true;
  }

  private async assertAnonymousPasswordResetAllowed(email: string) {
    const normalizedEmail = this.normalizeEmailAddress(email);
    const keyHash = this.hashVerificationToken(`password-reset:${normalizedEmail}`);
    const cooldownKey = `auth:password-reset:cooldown:${keyHash}`;
    const windowKey = `auth:password-reset:window:${keyHash}`;
    const cooldownSeconds = Math.ceil(PASSWORD_RESET_COOLDOWN_MS / 1000);
    const windowSeconds = Math.ceil(PASSWORD_RESET_WINDOW_MS / 1000);

    const cooldownAccepted = await this.cacheService.setIfAbsent(
      cooldownKey,
      "1",
      cooldownSeconds,
    );

    if (cooldownAccepted === false) {
      this.logSecurityEvent("warn", "Password reset request rate limited", {
        outcome: "cooldown_active",
        emailHash: this.hashSecurityIdentifier(normalizedEmail),
      });
      throw new HttpException(
        "Please wait before requesting another password reset email.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const requestCount = await this.cacheService.increment(
      windowKey,
      windowSeconds,
    );

    if (
      typeof requestCount === "number" &&
      requestCount > PASSWORD_RESET_WINDOW_LIMIT
    ) {
      this.logSecurityEvent("warn", "Password reset request rate limited", {
        outcome: "window_limit_exceeded",
        emailHash: this.hashSecurityIdentifier(normalizedEmail),
        requestCount,
      });
      throw new HttpException(
        "Too many password reset requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertCanIssueMobileOtp(userId: string) {
    const now = new Date();
    const latestChallenge = await this.prisma.mobileOtpChallenge.findFirst({
      where: {
        userId,
        purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        resendAvailableAt: true,
      },
    });

    if (
      latestChallenge &&
      latestChallenge.resendAvailableAt.getTime() > now.getTime()
    ) {
      this.logSecurityEvent("warn", "Mobile OTP request rate limited", {
        actorUserId: userId,
        outcome: "cooldown_active",
      });
      throw new HttpException(
        "Please wait before requesting another verification code.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const recentIssueCount = await this.prisma.mobileOtpChallenge.count({
      where: {
        userId,
        purpose: MOBILE_OTP_ENROLLMENT_PURPOSE,
        createdAt: {
          gte: new Date(now.getTime() - OTP_WINDOW_MS),
        },
      },
    });

    if (recentIssueCount >= OTP_WINDOW_LIMIT) {
      this.logSecurityEvent("warn", "Mobile OTP request rate limited", {
        actorUserId: userId,
        outcome: "window_limit_exceeded",
        recentIssueCount,
      });
      throw new HttpException(
        "Too many verification codes requested. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hashVerificationToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  private hashSecurityIdentifier(rawValue: string): string {
    return this.hashVerificationToken(rawValue).slice(0, 12);
  }

  private getSessionExpiryDate(): Date {
    const configured = this.configService.get<string>("jwt.expiresIn", "7d");
    const match = /^(\d+)([smhd])$/.exec(configured);

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number.parseInt(match[1] ?? "7", 10);
    const unit = match[2] ?? "d";
    const multiplier =
      unit === "s"
        ? 1000
        : unit === "m"
          ? 60 * 1000
          : unit === "h"
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;

    return new Date(Date.now() + amount * multiplier);
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    const normalized = phoneNumber.replace(/[\s()-]/g, "");

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new BadRequestException(
        "Enter a valid mobile number in international format.",
      );
    }

    return normalized;
  }

  private normalizeEmailAddress(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOpaqueToken(value: string): string {
    return value.trim();
  }

  private assertTrackedCurrentSessionId(currentSessionId?: string): string {
    const normalizedSessionId = currentSessionId?.trim();

    if (!normalizedSessionId) {
      throw new UnauthorizedException("Invalid authentication token");
    }

    return normalizedSessionId;
  }

  private logSecurityEvent(
    level: "log" | "warn" | "debug" | "verbose",
    message: string,
    metadata: Record<string, unknown>,
  ) {
    this.logger.logWithMeta(level, message, metadata, "AuthSecurity");
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }

    return `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`;
  }
}
