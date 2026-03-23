import {
  BadRequestException,
  HttpException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";

import { MailService } from "../../infrastructure/mail/mail.service";
import { CacheService } from "../../infrastructure/cache/cache.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";
import {
  SecurityAuditOutcome,
  SecurityAuditService,
  noopSecurityAuditService,
} from "../../infrastructure/logging/security-audit.service";
import { SmsService } from "../../infrastructure/sms/sms.service";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  AuthAbuseProtectionService,
  AuthActionContext,
  AuthThrottleDecision,
} from "./auth-abuse-protection.service";
import {
  AuthMetricsService,
  noopAuthMetricsService,
} from "./auth-metrics.service";

import {
  AUTH_ERROR_MESSAGES,
  authBadRequest,
  authConflict,
  authNotFound,
  authTooManyRequests,
  authUnauthorized,
} from "./auth-error-policy";
import {
  DeviceSessionService,
  type SessionRevokeResult,
} from "./device-session.service";
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
import { buildStoredPersonaTrustState } from "../personas/persona-trust";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_RESEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_LIMIT = 5;

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_WINDOW_LIMIT = 5;
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

type SessionContext = AuthActionContext;
type AuditContext = AuthActionContext;

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
    @Optional()
    private readonly securityAuditService: Pick<
      SecurityAuditService,
      "log"
    > = noopSecurityAuditService,
    @Optional()
    private readonly authMetricsService: AuthMetricsService = noopAuthMetricsService,
    @Optional()
    private readonly authAbuseProtectionService: AuthAbuseProtectionService = {
      getLoginThrottle: async () => null,
      recordLoginFailure: async () => null,
      consumeSignupAttempt: async () => null,
      consumePasswordResetRequest: async () => null,
      consumePasswordResetCompletion: async () => null,
      consumeVerificationResend: async () => null,
      consumeVerificationCompletion: async () => null,
      consumeMobileOtpRequest: async () => null,
      consumeMobileOtpVerification: async () => null,
    } as unknown as AuthAbuseProtectionService,
  ) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async signup(signupDto: SignupDto, auditContext?: AuditContext) {
    this.passwordPolicyService.validate(signupDto.password);

    const normalizedEmail = this.normalizeEmailAddress(signupDto.email);
    const signupThrottle =
      await this.authAbuseProtectionService.consumeSignupAttempt(
        normalizedEmail,
        auditContext,
      );

    if (signupThrottle) {
      this.authMetricsService.recordSignupThrottle(
        signupThrottle.reason as "email_rate_limited" | "ip_rate_limited",
      );
      this.throwThrottleException(
        "auth.signup",
        signupThrottle,
        AUTH_ERROR_MESSAGES.signupRateLimit,
        {
          requestContext: auditContext,
          reason: signupThrottle.reason,
          metadata: {
            emailHash: this.hashSecurityIdentifier(normalizedEmail),
          },
        },
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      this.authMetricsService.recordSignupFailure("email_already_registered");
      this.logAuthAuditEvent("auth.signup", "failure", {
        requestId: auditContext?.requestId,
        reason: "email_already_registered",
        metadata: {
          emailHash: this.hashSecurityIdentifier(normalizedEmail),
        },
      });
      throw authConflict(AUTH_ERROR_MESSAGES.emailAlreadyRegistered);
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
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

      this.authMetricsService.recordSignupSuccess();

      const mailDeliveryAvailable =
        (this.mailService as any).isEmailVerificationConfigured?.() ??
        this.mailService.isConfigured();

      this.logAuthAuditEvent("auth.signup", "success", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        metadata: {
          verificationPending: true,
          verificationEmailSent: verification.emailSent,
          mailDeliveryAvailable,
        },
      });

      this.logAuthAuditEvent("auth.email_verification.issue", "accepted", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        reason: "signup",
        metadata: {
          emailSent: verification.emailSent,
          expiresAt: verification.expiresAt.toISOString(),
        },
      });

      return {
        user,
        verificationPending: true,
        verificationEmailSent: verification.emailSent,
        mailDeliveryAvailable,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        this.logAuthAuditEvent("auth.signup", "failure", {
          requestId: auditContext?.requestId,
          reason: "email_already_registered",
          metadata: {
            emailHash: this.hashSecurityIdentifier(normalizedEmail),
          },
        });
        this.authMetricsService.recordSignupFailure("email_already_registered");
        throw authConflict(AUTH_ERROR_MESSAGES.emailAlreadyRegistered);
      }

      this.authMetricsService.recordSignupFailure("system_error");

      throw error;
    }
  }

  async login(loginDto: LoginDto, context?: SessionContext) {
    try {
      const normalizedEmail = this.normalizeEmailAddress(loginDto.email);
      const loginThrottle =
        await this.authAbuseProtectionService.getLoginThrottle(
          normalizedEmail,
          context,
        );

      if (loginThrottle) {
        this.authMetricsService.recordLoginThrottle(
          loginThrottle.reason as
            | "account_lockout"
            | "account_ip_lockout"
            | "ip_lockout",
        );
        this.throwThrottleException(
          "auth.login",
          loginThrottle,
          AUTH_ERROR_MESSAGES.loginTemporarilyLocked,
          {
            requestContext: context,
            reason: loginThrottle.reason,
            metadata: {
              emailHash: this.hashSecurityIdentifier(normalizedEmail),
            },
          },
        );
      }

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
        const escalatedProtection =
          await this.authAbuseProtectionService.recordLoginFailure(
            normalizedEmail,
            context,
          );
        this.authMetricsService.recordLoginFailure("unknown_email");
        this.logAuthAuditEvent("auth.login", "failure", {
          requestId: context?.requestId,
          reason: "unknown_email",
          metadata: {
            emailHash: this.hashSecurityIdentifier(normalizedEmail),
            ...(escalatedProtection
              ? {
                  escalatedProtectionReason: escalatedProtection.reason,
                  challengeRecommended:
                    escalatedProtection.challengeRecommended,
                }
              : {}),
          },
        });
        throw authUnauthorized(AUTH_ERROR_MESSAGES.invalidCredentials);
      }

      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        const escalatedProtection =
          await this.authAbuseProtectionService.recordLoginFailure(
            normalizedEmail,
            context,
          );
        this.authMetricsService.recordLoginFailure("invalid_password");
        this.logAuthAuditEvent("auth.login", "failure", {
          actorUserId: user.id,
          requestId: context?.requestId,
          reason: "invalid_password",
          metadata: escalatedProtection
            ? {
                escalatedProtectionReason: escalatedProtection.reason,
                challengeRecommended: escalatedProtection.challengeRecommended,
              }
            : undefined,
        });
        throw authUnauthorized(AUTH_ERROR_MESSAGES.invalidCredentials);
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

      this.authMetricsService.recordLoginSuccess();

      this.logAuthAuditEvent("auth.login", "success", {
        actorUserId: user.id,
        requestId: context?.requestId,
        sessionId: session.id,
        metadata: {
          expiresAt: expiresAt.toISOString(),
          hasUserAgent: Boolean(context?.userAgent),
          hasIpAddress: Boolean(context?.ipAddress),
        },
      });

      return {
        accessToken,
        sessionId: session.id,
        expiresAt,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordLoginFailure("system_error");
      }

      throw error;
    }
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
    auditContext?: AuditContext,
  ) {
    try {
      const verificationThrottle =
        await this.authAbuseProtectionService.consumeVerificationCompletion(
          auditContext,
        );

      if (verificationThrottle) {
        this.authMetricsService.recordVerificationEmailCompletion(
          "throttled",
          "ip_rate_limited",
        );
        this.throwThrottleException(
          "auth.email_verification.complete",
          verificationThrottle,
          AUTH_ERROR_MESSAGES.verificationAttemptRateLimit,
          {
            requestContext: auditContext,
            reason: verificationThrottle.reason,
          },
        );
      }

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
        this.authMetricsService.recordVerificationEmailCompletion(
          "failure",
          "invalid_or_expired_token",
        );
        this.logAuthAuditEvent("auth.email_verification.complete", "failure", {
          requestId: auditContext?.requestId,
          reason: "invalid_or_expired_token",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.invalidVerificationLink);
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

        this.authMetricsService.recordVerificationEmailCompletion(
          "accepted",
          "already_verified",
        );

        this.logAuthAuditEvent("auth.email_verification.complete", "accepted", {
          actorUserId: token.user.id,
          requestId: auditContext?.requestId,
          targetType: "user",
          targetId: token.user.id,
          reason: "already_verified",
          metadata: {
            alreadyVerified: true,
          },
        });

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
        this.authMetricsService.recordVerificationEmailCompletion(
          "failure",
          "invalid_or_expired_token",
        );
        this.logAuthAuditEvent("auth.email_verification.complete", "failure", {
          actorUserId: token.userId,
          requestId: auditContext?.requestId,
          reason: "invalid_or_expired_token",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.invalidVerificationLink);
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

        await this.syncPersonaTrustState(tx, token.userId, {
          isVerified: true,
          phoneVerifiedAt: verifiedUser.phoneVerifiedAt,
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

      this.authMetricsService.recordVerificationEmailCompletion(
        "success",
        "none",
      );

      this.logAuthAuditEvent("auth.email_verification.complete", "success", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        metadata: {
          alreadyVerified: false,
        },
      });

      return {
        verified: true,
        alreadyVerified: false,
        user,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordVerificationEmailCompletion(
          "failure",
          "system_error",
        );
      }

      throw error;
    }
  }

  async resendVerificationEmail(
    resendVerificationEmailDto: ResendVerificationEmailDto,
    auditContext?: AuditContext,
  ) {
    try {
      const normalizedEmail = this.normalizeEmailAddress(
        resendVerificationEmailDto.email,
      );
      const resendThrottle =
        await this.authAbuseProtectionService.consumeVerificationResend(
          normalizedEmail,
          auditContext,
        );

      if (resendThrottle) {
        this.authMetricsService.recordVerificationResend(
          "throttled",
          resendThrottle.reason as
            | "email_rate_limited"
            | "ip_rate_limited"
            | "session_rate_limited",
        );
        this.throwThrottleException(
          "auth.email_verification.resend",
          resendThrottle,
          AUTH_ERROR_MESSAGES.verificationEmailRateLimit,
          {
            requestContext: auditContext,
            reason: resendThrottle.reason,
            metadata: {
              emailHash: this.hashSecurityIdentifier(normalizedEmail),
            },
          },
        );
      }

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
        this.authMetricsService.recordVerificationResend(
          "suppressed",
          user ? "already_verified" : "unknown_email",
        );
        this.logAuthAuditEvent("auth.email_verification.resend", "suppressed", {
          actorUserId: user?.id,
          requestId: auditContext?.requestId,
          reason: user ? "already_verified" : "unknown_email",
          metadata: {
            emailHash: this.hashSecurityIdentifier(normalizedEmail),
          },
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

      await this.assertCanResendVerificationEmail(user.id, auditContext);

      const verification = await this.issueEmailVerificationToken(
        user.id,
        user.email,
        "resend",
      );

      this.authMetricsService.recordVerificationResend("issued", "none");

      await this.analyticsService.trackVerificationResend({
        actorUserId: user.id,
        emailSent: verification.emailSent,
      });

      this.logAuthAuditEvent("auth.email_verification.resend", "accepted", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        metadata: {
          emailSent: verification.emailSent,
          expiresAt: verification.expiresAt.toISOString(),
        },
      });

      return {
        accepted: true,
        verificationPending: true,
        verificationEmailSent: verification.emailSent,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordVerificationResend(
          "failed",
          "system_error",
        );
      }

      throw error;
    }
  }

  async resendVerificationEmailForCurrentUser(
    userId: string,
    auditContext?: AuditContext,
  ) {
    try {
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
        throw authUnauthorized();
      }

      if (user.isVerified) {
        this.authMetricsService.recordVerificationResend(
          "suppressed",
          "already_verified",
        );
        this.logAuthAuditEvent("auth.email_verification.resend", "suppressed", {
          actorUserId: user.id,
          requestId: auditContext?.requestId,
          reason: "already_verified",
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

      const resendThrottle =
        await this.authAbuseProtectionService.consumeVerificationResend(
          user.email,
          auditContext,
        );

      if (resendThrottle) {
        this.authMetricsService.recordVerificationResend(
          "throttled",
          resendThrottle.reason as
            | "email_rate_limited"
            | "ip_rate_limited"
            | "session_rate_limited",
        );
        this.throwThrottleException(
          "auth.email_verification.resend",
          resendThrottle,
          AUTH_ERROR_MESSAGES.verificationEmailRateLimit,
          {
            actorUserId: user.id,
            requestContext: auditContext,
            reason: resendThrottle.reason,
            metadata: {
              emailHash: this.hashSecurityIdentifier(user.email),
            },
          },
        );
      }

      await this.assertCanResendVerificationEmail(user.id, auditContext);

      const verification = await this.issueEmailVerificationToken(
        user.id,
        user.email,
        "resend",
      );

      this.authMetricsService.recordVerificationResend("issued", "none");

      await this.analyticsService.trackVerificationResend({
        actorUserId: user.id,
        emailSent: verification.emailSent,
      });

      this.logAuthAuditEvent("auth.email_verification.resend", "accepted", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        metadata: {
          emailSent: verification.emailSent,
          expiresAt: verification.expiresAt.toISOString(),
        },
      });

      return {
        accepted: true,
        verificationPending: true,
        verificationEmailSent: verification.emailSent,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordVerificationResend(
          "failed",
          "system_error",
        );
      }

      throw error;
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    currentSessionId?: string,
    auditContext?: AuditContext,
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
      throw authUnauthorized();
    }

    const currentPasswordMatches = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      this.logAuthAuditEvent("auth.password.change", "failure", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        sessionId: currentSessionId,
        reason: "incorrect_current_password",
      });
      throw authBadRequest(AUTH_ERROR_MESSAGES.currentPasswordIncorrect);
    }

    this.passwordPolicyService.validate(changePasswordDto.newPassword, {
      currentPassword: changePasswordDto.currentPassword,
    });

    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);
    const passwordChangeTimestamp = new Date();

    await this.prismaService.$transaction(async (tx: any) => {
      await tx.user.update({
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

      await tx.passwordResetToken.updateMany({
        where: {
          userId,
          consumedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: passwordChangeTimestamp,
        },
      });

      if (currentSessionId) {
        await this.deviceSessionService.revokeOtherSessions(
          userId,
          currentSessionId,
          "password_changed",
          tx,
        );
      } else {
        await this.deviceSessionService.revokeAllSessions(
          userId,
          "password_changed",
          tx,
        );
      }
    });

    this.logAuthAuditEvent("auth.password.change", "success", {
      actorUserId: userId,
      requestId: auditContext?.requestId,
      sessionId: currentSessionId,
      metadata: {
        retainedCurrentSession: Boolean(currentSessionId),
      },
    });

    return {
      success: true,
      signedOutSessions: true,
    };
  }

  async requestPasswordReset(
    forgotPasswordDto: ForgotPasswordDto,
    auditContext?: AuditContext,
  ) {
    try {
      const normalizedEmail = this.normalizeEmailAddress(
        forgotPasswordDto.email,
      );

      const passwordResetThrottle =
        await this.authAbuseProtectionService.consumePasswordResetRequest(
          normalizedEmail,
          auditContext,
        );

      if (passwordResetThrottle) {
        this.authMetricsService.recordPasswordResetRequest(
          "throttled",
          passwordResetThrottle.reason as
            | "email_rate_limited"
            | "ip_rate_limited",
        );
        this.throwThrottleException(
          "auth.password_reset.request",
          passwordResetThrottle,
          AUTH_ERROR_MESSAGES.passwordResetRateLimit,
          {
            requestContext: auditContext,
            reason: passwordResetThrottle.reason,
            metadata: {
              emailHash: this.hashSecurityIdentifier(normalizedEmail),
            },
          },
        );
      }

      await this.assertAnonymousPasswordResetAllowed(
        normalizedEmail,
        auditContext,
      );

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
        this.authMetricsService.recordPasswordResetRequest(
          "requested",
          "unknown_email",
        );
        this.logAuthAuditEvent("auth.password_reset.request", "accepted", {
          requestId: auditContext?.requestId,
          reason: "unknown_email",
          metadata: {
            emailHash: this.hashSecurityIdentifier(normalizedEmail),
            emailSent: false,
          },
        });
        return PASSWORD_RESET_GENERIC_RESPONSE;
      }

      const canIssuePasswordReset = await this.canIssuePasswordReset(user.id);

      if (!canIssuePasswordReset) {
        this.authMetricsService.recordPasswordResetRequest(
          "suppressed",
          "per_account_rate_limited",
        );
        this.logAuthAuditEvent("auth.password_reset.request", "suppressed", {
          actorUserId: user.id,
          requestId: auditContext?.requestId,
          reason: "per_account_rate_limited",
        });
        return PASSWORD_RESET_GENERIC_RESPONSE;
      }

      const passwordReset = await this.issuePasswordResetToken(
        user.id,
        user.email,
      );

      this.authMetricsService.recordPasswordResetRequest(
        "requested",
        passwordReset.emailSent ? "issued" : "delivery_failed",
      );

      this.logAuthAuditEvent("auth.password_reset.request", "accepted", {
        actorUserId: user.id,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: user.id,
        metadata: {
          emailHash: this.hashSecurityIdentifier(normalizedEmail),
          emailSent: passwordReset.emailSent,
        },
      });

      return PASSWORD_RESET_GENERIC_RESPONSE;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordPasswordResetRequest(
          "failed",
          "system_error",
        );
      }

      throw error;
    }
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    auditContext?: AuditContext,
  ) {
    try {
      const passwordResetCompletionThrottle =
        await this.authAbuseProtectionService.consumePasswordResetCompletion(
          auditContext,
        );

      if (passwordResetCompletionThrottle) {
        this.authMetricsService.recordPasswordResetCompletion(
          "throttled",
          "ip_rate_limited",
        );
        this.throwThrottleException(
          "auth.password_reset.complete",
          passwordResetCompletionThrottle,
          AUTH_ERROR_MESSAGES.passwordResetRateLimit,
          {
            requestContext: auditContext,
            reason: passwordResetCompletionThrottle.reason,
          },
        );
      }

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
        this.authMetricsService.recordPasswordResetCompletion(
          "failed",
          "invalid_or_expired_token",
        );
        this.logAuthAuditEvent("auth.password_reset.complete", "failure", {
          requestId: auditContext?.requestId,
          reason: "invalid_or_expired_token",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.invalidResetLink);
      }

      this.passwordPolicyService.validate(resetPasswordDto.password);

      const alreadyUsed = await bcrypt.compare(
        resetPasswordDto.password,
        token.user.passwordHash,
      );

      if (alreadyUsed) {
        this.authMetricsService.recordPasswordResetCompletion(
          "failed",
          "password_reuse",
        );
        this.logAuthAuditEvent("auth.password_reset.complete", "failure", {
          actorUserId: token.userId,
          requestId: auditContext?.requestId,
          reason: "password_reuse",
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

        await this.deviceSessionService.revokeAllSessions(
          token.userId,
          "password_reset",
          tx,
        );
      });

      this.authMetricsService.recordPasswordResetCompletion(
        "completed",
        "none",
      );

      this.logAuthAuditEvent("auth.password_reset.complete", "success", {
        actorUserId: token.userId,
        requestId: auditContext?.requestId,
        targetType: "user",
        targetId: token.userId,
        metadata: {
          revokedAllSessions: true,
        },
      });

      return {
        success: true,
        signedOutSessions: true,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordPasswordResetCompletion(
          "failed",
          "system_error",
        );
      }

      throw error;
    }
  }

  async requestMobileOtp(
    userId: string,
    requestMobileOtpDto: RequestMobileOtpDto,
    auditContext?: AuditContext,
  ) {
    try {
      const normalizedPhoneNumber = this.normalizePhoneNumber(
        requestMobileOtpDto.phoneNumber,
      );

      const otpRequestThrottle =
        await this.authAbuseProtectionService.consumeMobileOtpRequest(
          normalizedPhoneNumber,
          auditContext,
        );

      if (otpRequestThrottle) {
        this.authMetricsService.recordOtpRequest(
          "throttled",
          otpRequestThrottle.reason as
            | "phone_rate_limited"
            | "session_rate_limited"
            | "ip_rate_limited",
        );
        this.throwThrottleException(
          "auth.mobile_otp.request",
          otpRequestThrottle,
          AUTH_ERROR_MESSAGES.mobileOtpRequestRateLimit,
          {
            actorUserId: userId,
            requestContext: auditContext,
            reason: otpRequestThrottle.reason,
            metadata: {
              phoneNumberMasked: this.maskPhoneNumber(normalizedPhoneNumber),
            },
          },
        );
      }

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
        throw authUnauthorized();
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
        this.authMetricsService.recordOtpRequest(
          "blocked",
          "phone_already_verified_elsewhere",
        );
        this.logAuthAuditEvent("auth.mobile_otp.request", "blocked", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          reason: "phone_already_verified_elsewhere",
        });
        throw authConflict(AUTH_ERROR_MESSAGES.mobileNumberAlreadyVerified);
      }

      await this.assertCanIssueMobileOtp(userId, auditContext);

      const issued = await this.issueMobileOtp(userId, normalizedPhoneNumber);

      this.authMetricsService.recordOtpRequest("requested", "none");
      this.authMetricsService.recordOtpRequest(
        issued.deliverySucceeded ? "sent" : "failed",
        issued.deliverySucceeded ? "none" : "delivery_failed",
      );

      this.logAuthAuditEvent("auth.mobile_otp.request", "accepted", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        targetType: "mobile_otp_challenge",
        targetId: issued.challengeId,
        metadata: {
          phoneNumberMasked: this.maskPhoneNumber(normalizedPhoneNumber),
          deliveryAvailable: this.smsService.isConfigured(),
          expiresAt: issued.expiresAt.toISOString(),
        },
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
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordOtpRequest("failed", "system_error");
      }

      throw error;
    }
  }

  async verifyMobileOtp(
    userId: string,
    verifyMobileOtpDto: VerifyMobileOtpDto,
    auditContext?: AuditContext,
  ) {
    try {
      const otpVerifyThrottle =
        await this.authAbuseProtectionService.consumeMobileOtpVerification(
          auditContext,
        );

      if (otpVerifyThrottle) {
        this.authMetricsService.recordOtpVerification(
          "throttled",
          otpVerifyThrottle.reason as
            | "session_rate_limited"
            | "ip_rate_limited",
        );
        this.throwThrottleException(
          "auth.mobile_otp.verify",
          otpVerifyThrottle,
          AUTH_ERROR_MESSAGES.mobileOtpVerificationRateLimit,
          {
            actorUserId: userId,
            requestContext: auditContext,
            reason: otpVerifyThrottle.reason,
          },
        );
      }

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
        this.authMetricsService.recordOtpVerification(
          "failed",
          "challenge_not_found",
        );
        this.logAuthAuditEvent("auth.mobile_otp.verify", "failure", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          reason: "challenge_not_found",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.mobileOtpRequestRequired);
      }

      if (challenge.consumedAt || challenge.supersededAt) {
        this.authMetricsService.recordOtpVerification(
          "failed",
          "inactive_challenge",
        );
        this.logAuthAuditEvent("auth.mobile_otp.verify", "failure", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          targetType: "mobile_otp_challenge",
          targetId: challenge.id,
          reason: "inactive_challenge",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.mobileOtpInactive);
      }

      if (challenge.expiresAt.getTime() <= now.getTime()) {
        this.authMetricsService.recordOtpVerification(
          "failed",
          "expired_challenge",
        );
        this.logAuthAuditEvent("auth.mobile_otp.verify", "failure", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          targetType: "mobile_otp_challenge",
          targetId: challenge.id,
          reason: "expired_challenge",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.mobileOtpExpired);
      }

      if (challenge.invalidAttemptCount >= OTP_MAX_ATTEMPTS) {
        this.authMetricsService.recordOtpVerification(
          "throttled",
          "attempt_limit_reached",
        );
        this.logAuthAuditEvent("auth.mobile_otp.verify", "rate_limited", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          targetType: "mobile_otp_challenge",
          targetId: challenge.id,
          reason: "attempt_limit_reached",
        });
        throw authTooManyRequests(
          AUTH_ERROR_MESSAGES.mobileOtpAttemptRateLimit,
        );
      }

      if (
        challenge.lastAttemptAt &&
        now.getTime() - challenge.lastAttemptAt.getTime() <
          OTP_ATTEMPT_COOLDOWN_MS
      ) {
        this.authMetricsService.recordOtpVerification(
          "throttled",
          "attempt_cooldown_active",
        );
        this.logAuthAuditEvent("auth.mobile_otp.verify", "rate_limited", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          targetType: "mobile_otp_challenge",
          targetId: challenge.id,
          reason: "attempt_cooldown_active",
        });
        throw authTooManyRequests(AUTH_ERROR_MESSAGES.mobileOtpAttemptCooldown);
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

        this.authMetricsService.recordOtpVerification(
          nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS ? "throttled" : "invalid",
          nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS
            ? "attempt_limit_reached"
            : "invalid_code",
        );

        this.logAuthAuditEvent(
          "auth.mobile_otp.verify",
          nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS
            ? "rate_limited"
            : "failure",
          {
            actorUserId: userId,
            requestId: auditContext?.requestId,
            targetType: "mobile_otp_challenge",
            targetId: challenge.id,
            reason:
              nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS
                ? "attempt_limit_reached"
                : "invalid_code",
            metadata: {
              invalidAttemptCount: nextInvalidAttemptCount,
            },
          },
        );

        if (nextInvalidAttemptCount >= OTP_MAX_ATTEMPTS) {
          throw authTooManyRequests(
            AUTH_ERROR_MESSAGES.mobileOtpAttemptRateLimit,
          );
        }

        throw authBadRequest(AUTH_ERROR_MESSAGES.mobileOtpInvalid);
      }

      await this.prismaService.$transaction(async (tx: any) => {
        let updatedUser;

        try {
          updatedUser = await tx.user.update({
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
              isVerified: true,
              phoneVerifiedAt: true,
            },
          });
        } catch (error) {
          if (
            (error instanceof Prisma.PrismaClientKnownRequestError ||
              (typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "P2002")) &&
            error.code === "P2002"
          ) {
            throw authConflict(AUTH_ERROR_MESSAGES.mobileNumberAlreadyVerified);
          }

          throw error;
        }

        await this.syncPersonaTrustState(tx, userId, updatedUser);

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

      this.authMetricsService.recordOtpVerification("verified", "none");

      this.logAuthAuditEvent("auth.mobile_otp.verify", "success", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        targetType: "mobile_otp_challenge",
        targetId: challenge.id,
        metadata: {
          phoneNumberMasked: this.maskPhoneNumber(challenge.phoneNumber),
        },
      });

      return {
        verified: true,
        phoneNumber: this.maskPhoneNumber(challenge.phoneNumber),
        verifiedAt: now,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordOtpVerification("failed", "system_error");
      }

      throw error;
    }
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
    auditContext?: AuditContext,
  ) {
    try {
      const trackedCurrentSessionId =
        this.assertTrackedCurrentSessionId(currentSessionId);
      const requestedSessionId = this.normalizeOpaqueToken(dto.sessionId);

      if (requestedSessionId === trackedCurrentSessionId) {
        this.authMetricsService.recordSessionSecurity(
          "revoke",
          "blocked",
          "current_session_protected",
        );
        this.logAuthAuditEvent("auth.session.revoke", "blocked", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          sessionId: trackedCurrentSessionId,
          targetType: "session",
          targetId: requestedSessionId,
          reason: "current_session_protected",
        });
        throw authBadRequest(AUTH_ERROR_MESSAGES.currentSessionRevokeBlocked);
      }

      const revoked = await this.deviceSessionService.revokeSession(
        userId,
        requestedSessionId,
        "remote_sign_out",
      );

      if (revoked.status === "not_found") {
        this.authMetricsService.recordSessionSecurity(
          "revoke",
          "failure",
          "session_not_found",
        );
        this.logAuthAuditEvent("auth.session.revoke", "failure", {
          actorUserId: userId,
          requestId: auditContext?.requestId,
          sessionId: trackedCurrentSessionId,
          targetType: "session",
          targetId: requestedSessionId,
          reason: "session_not_found",
        });
        throw authNotFound(AUTH_ERROR_MESSAGES.sessionNotFound);
      }

      const revokeOutcome = this.getSessionRevokeOutcome(revoked);

      this.authMetricsService.recordSessionSecurity(
        "revoke",
        "success",
        revokeOutcome,
      );

      this.logAuthAuditEvent("auth.session.revoke", "success", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        sessionId: trackedCurrentSessionId,
        targetType: "session",
        targetId: requestedSessionId,
        reason: revokeOutcome,
        metadata:
          revoked.status === "already_inactive"
            ? {
                alreadyInactive: true,
              }
            : undefined,
      });

      return {
        success: true,
        ...(revoked.status === "already_inactive"
          ? {
              alreadyInactive: true,
            }
          : {}),
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordSessionSecurity(
          "revoke",
          "failure",
          "system_error",
        );
      }

      throw error;
    }
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    auditContext?: AuditContext,
  ) {
    try {
      const trackedCurrentSessionId =
        this.assertTrackedCurrentSessionId(currentSessionId);
      const revokedCount = await this.deviceSessionService.revokeOtherSessions(
        userId,
        trackedCurrentSessionId,
        "sign_out_other_sessions",
      );

      this.authMetricsService.recordSessionSecurity(
        "revoke_others",
        "success",
        "sign_out_other_sessions",
      );

      this.logAuthAuditEvent("auth.session.revoke_others", "success", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        sessionId: trackedCurrentSessionId,
        reason: "sign_out_other_sessions",
        metadata: {
          revokedCount,
        },
      });

      return {
        success: true,
        revokedCount,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordSessionSecurity(
          "revoke_others",
          "failure",
          "system_error",
        );
      }

      throw error;
    }
  }

  async revokeCurrentSession(
    userId: string,
    currentSessionId: string,
    auditContext?: AuditContext,
  ) {
    try {
      const trackedCurrentSessionId =
        this.assertTrackedCurrentSessionId(currentSessionId);
      await this.deviceSessionService.revokeSession(
        userId,
        trackedCurrentSessionId,
        "logout",
      );

      this.authMetricsService.recordSessionSecurity(
        "logout_current",
        "success",
        "logout",
      );

      this.logAuthAuditEvent("auth.session.logout_current", "success", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        sessionId: trackedCurrentSessionId,
        reason: "logout",
      });

      return {
        success: true,
      };
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.authMetricsService.recordSessionSecurity(
          "logout_current",
          "failure",
          "system_error",
        );
      }

      throw error;
    }
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

    this.authMetricsService.recordVerificationEmailIssued(context);

    if (!emailSent) {
      this.authMetricsService.recordVerificationEmailDeliveryFailed(context);
    }

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
    const createdChallenge = await this.prismaService.$transaction(
      async (tx: any) => {
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
      },
    );

    const deliverySucceeded = await this.smsService.sendOtp({
      to: phoneNumber,
      code,
      expiresInMinutes: Math.round(OTP_TTL_MS / (60 * 1000)),
    });

    return {
      challengeId: createdChallenge.id,
      purpose: createdChallenge.purpose,
      expiresAt,
      resendAvailableAt,
      deliverySucceeded,
    };
  }

  private async assertCanResendVerificationEmail(
    userId: string,
    auditContext?: AuditContext,
  ) {
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
      this.authMetricsService.recordVerificationResend(
        "throttled",
        "cooldown_active",
      );
      this.logAuthAuditEvent("auth.email_verification.resend", "rate_limited", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        reason: "cooldown_active",
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.verificationEmailCooldown);
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
      this.authMetricsService.recordVerificationResend(
        "throttled",
        "window_limit_exceeded",
      );
      this.logAuthAuditEvent("auth.email_verification.resend", "rate_limited", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        reason: "window_limit_exceeded",
        metadata: {
          recentIssueCount,
        },
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.verificationEmailRateLimit);
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

  private async assertAnonymousPasswordResetAllowed(
    email: string,
    auditContext?: AuditContext,
  ) {
    const normalizedEmail = this.normalizeEmailAddress(email);
    const keyHash = this.hashVerificationToken(
      `password-reset:${normalizedEmail}`,
    );
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
      this.authMetricsService.recordPasswordResetRequest(
        "throttled",
        "cooldown_active",
      );
      this.logAuthAuditEvent("auth.password_reset.request", "rate_limited", {
        requestId: auditContext?.requestId,
        reason: "cooldown_active",
        metadata: {
          emailHash: this.hashSecurityIdentifier(normalizedEmail),
        },
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.passwordResetCooldown);
    }

    const requestCount = await this.cacheService.increment(
      windowKey,
      windowSeconds,
    );

    if (
      typeof requestCount === "number" &&
      requestCount > PASSWORD_RESET_WINDOW_LIMIT
    ) {
      this.authMetricsService.recordPasswordResetRequest(
        "throttled",
        "window_limit_exceeded",
      );
      this.logAuthAuditEvent("auth.password_reset.request", "rate_limited", {
        requestId: auditContext?.requestId,
        reason: "window_limit_exceeded",
        metadata: {
          emailHash: this.hashSecurityIdentifier(normalizedEmail),
          requestCount,
        },
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.passwordResetRateLimit);
    }
  }

  private async assertCanIssueMobileOtp(
    userId: string,
    auditContext?: AuditContext,
  ) {
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
      this.authMetricsService.recordOtpRequest("throttled", "cooldown_active");
      this.logAuthAuditEvent("auth.mobile_otp.request", "rate_limited", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        reason: "cooldown_active",
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.mobileOtpRequestCooldown);
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
      this.authMetricsService.recordOtpRequest(
        "throttled",
        "window_limit_exceeded",
      );
      this.logAuthAuditEvent("auth.mobile_otp.request", "rate_limited", {
        actorUserId: userId,
        requestId: auditContext?.requestId,
        reason: "window_limit_exceeded",
        metadata: {
          recentIssueCount,
        },
      });
      throw authTooManyRequests(AUTH_ERROR_MESSAGES.mobileOtpRequestRateLimit);
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

  private async syncPersonaTrustState(
    tx: any,
    userId: string,
    user: {
      isVerified: boolean;
      phoneVerifiedAt?: Date | null;
      businessVerified?: boolean;
    },
  ): Promise<void> {
    const trustState = buildStoredPersonaTrustState(user);

    await tx.persona.updateMany({
      where: {
        userId,
      },
      data: trustState,
    });
  }

  private normalizeOpaqueToken(value: string): string {
    return value.trim();
  }

  private assertTrackedCurrentSessionId(currentSessionId?: string): string {
    const normalizedSessionId = currentSessionId?.trim();

    if (!normalizedSessionId) {
      throw authUnauthorized();
    }

    return normalizedSessionId;
  }

  private getSessionRevokeOutcome(
    result: SessionRevokeResult,
  ): "remote_sign_out" | "already_inactive" {
    return result.status === "already_inactive"
      ? "already_inactive"
      : "remote_sign_out";
  }

  private throwThrottleException(
    action: string,
    decision: AuthThrottleDecision,
    message: string,
    input: {
      actorUserId?: string | null;
      requestContext?: AuthActionContext;
      targetType?: string | null;
      targetId?: string | null;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): never {
    this.logAuthAuditEvent(action, "rate_limited", {
      actorUserId: input.actorUserId,
      requestId: input.requestContext?.requestId,
      sessionId: input.requestContext?.sessionId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? decision.reason,
      policySource: decision.policyName,
      metadata: {
        throttleDimension: decision.dimension,
        riskLevel: decision.riskLevel,
        challengeRecommended: decision.challengeRecommended,
        ...input.metadata,
      },
    });

    throw authTooManyRequests(message);
  }

  private logAuthAuditEvent(
    action: string,
    outcome: SecurityAuditOutcome,
    input: {
      actorUserId?: string | null;
      requestId?: string | null;
      sessionId?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      reason?: string | null;
      policySource?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.securityAuditService.log({
      action,
      outcome,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      sessionId: input.sessionId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      policySource: input.policySource,
      metadata: input.metadata,
    });
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return phoneNumber;
    }

    return `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`;
  }
}
