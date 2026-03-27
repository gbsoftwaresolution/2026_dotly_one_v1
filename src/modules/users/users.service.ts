import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { MailService } from "../../infrastructure/mail/mail.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SmsService } from "../../infrastructure/sms/sms.service";
import { AuthService } from "../auth/auth.service";
import { ChangePasswordDto } from "../auth/dto/change-password.dto";
import { RequestMobileOtpDto } from "../auth/dto/request-mobile-otp.dto";
import { RevokeSessionDto } from "../auth/dto/revoke-session.dto";
import { VerifyMobileOtpDto } from "../auth/dto/verify-mobile-otp.dto";
import { AuthActionContext } from "../auth/auth-abuse-protection.service";
import {
  buildUserTrustFactors,
  userHasActiveTrustFactor,
  TrustFactor,
  VerificationPolicyService,
  VerificationRequirement,
} from "../auth/verification-policy.service";
import {
  ActivationMilestonesService,
  isActivationNudgeQueue,
  noopActivationMilestonesService,
} from "./activation-milestones.service";

type UserTrustFactorStatus = "active" | "inactive" | "planned";

function maskEmailAddress(email: string): string {
  const [localPart, domain = ""] = email.split("@");

  if (!localPart) {
    return email;
  }

  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  const maskedLocalPart =
    localPart.length <= 2
      ? `${visiblePrefix}***`
      : `${visiblePrefix}${"*".repeat(Math.max(2, localPart.length - visiblePrefix.length))}`;

  return domain ? `${maskedLocalPart}@${domain}` : maskedLocalPart;
}

function getTrustFactorLabel(factor: TrustFactor): string {
  switch (factor) {
    case "email_verified":
      return "Email verified";
    case "mobile_otp_verified":
      return "Mobile OTP verified";
  }
}

function getTrustFactorDescription(factor: TrustFactor): string {
  switch (factor) {
    case "email_verified":
      return "Email verification is the first trust factor for your Dotly identity and unlocks current trust-sensitive actions.";
    case "mobile_otp_verified":
      return "Verify a mobile number to add a second live trust factor for step-up account protection and future phone-based sign-in.";
  }
}

function maskPhoneNumber(
  phoneNumber: string | null | undefined,
): string | null {
  if (!phoneNumber) {
    return null;
  }

  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-2)}`;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly verificationPolicyService: VerificationPolicyService,
    private readonly authService: AuthService,
    @Optional()
    @Inject(ActivationMilestonesService)
    private readonly activationMilestonesService: Pick<
      ActivationMilestonesService,
      "getUserActivation" | "clearFirstResponseNudge"
    > = noopActivationMilestonesService,
  ) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async getCurrentUser(userId: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        isVerified: true,
        referralCode: true,
        referredBy: true,
        phoneNumber: true,
        pendingPhoneNumber: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const activation = await this.activationMilestonesService.getUserActivation(
      userId,
    );

    const activeMobileOtpEnrollment =
      await this.prisma.mobileOtpChallenge.findFirst({
        where: {
          userId,
          purpose: "ENROLLMENT",
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          purpose: true,
          phoneNumber: true,
          resendAvailableAt: true,
          expiresAt: true,
        },
      });

    const requirementCatalog =
      this.verificationPolicyService.getRequirementCatalog();
    const trustFactorCatalog =
      this.verificationPolicyService.getAvailableTrustFactors();
    const userFactors: Record<TrustFactor, boolean> =
      buildUserTrustFactors(user);
    const hasActiveTrustFactor = userHasActiveTrustFactor(user);

    const requirements = Object.entries(requirementCatalog).map(
      ([key, definition]) => ({
        key: key as VerificationRequirement,
        label: definition.label,
        unlocked: definition.anyOf.some((factor) => userFactors[factor]),
      }),
    );

    const trustFactors = trustFactorCatalog.map((factor) => {
      let status: UserTrustFactorStatus = "planned";

      if (factor.factor === "email_verified") {
        status = user.isVerified ? "active" : "inactive";
      } else if (factor.available) {
        status = userFactors[factor.factor] ? "active" : "inactive";
      }

      return {
        key: factor.factor,
        label: getTrustFactorLabel(factor.factor),
        status,
        description: getTrustFactorDescription(factor.factor),
      };
    });

    return {
      ...user,
      activation,
      security: {
        trustBadge: hasActiveTrustFactor ? "verified" : "attention",
        maskedEmail: maskEmailAddress(user.email),
        maskedPhoneNumber: maskPhoneNumber(
          user.phoneNumber ??
            activeMobileOtpEnrollment?.phoneNumber ??
            user.pendingPhoneNumber,
        ),
        phoneVerificationStatus: user.phoneVerifiedAt
          ? "verified"
          : activeMobileOtpEnrollment || user.pendingPhoneNumber
            ? "pending"
            : "not_enrolled",
        mobileOtpEnrollment: activeMobileOtpEnrollment
          ? {
              challengeId: activeMobileOtpEnrollment.id,
              purpose: activeMobileOtpEnrollment.purpose,
              maskedPhoneNumber:
                maskPhoneNumber(activeMobileOtpEnrollment.phoneNumber) ??
                activeMobileOtpEnrollment.phoneNumber,
              resendAvailableAt: activeMobileOtpEnrollment.resendAvailableAt,
              expiresAt: activeMobileOtpEnrollment.expiresAt,
              canResend:
                activeMobileOtpEnrollment.resendAvailableAt.getTime() <=
                now.getTime(),
            }
          : null,
        mailDeliveryAvailable:
          (this.mailService as any).isEmailVerificationConfigured?.() ??
          this.mailService.isConfigured(),
        passwordResetAvailable:
          (this.mailService as any).isPasswordResetConfigured?.() ??
          this.mailService.isConfigured(),
        smsDeliveryAvailable: this.smsService.isConfigured(),
        explanation:
          user.isVerified && user.phoneVerifiedAt
            ? "Email verification and mobile OTP are both active trust factors on this account. Current trust-sensitive actions accept either signal."
            : user.phoneVerifiedAt
              ? "Mobile OTP is active and currently satisfies Dotly trust checks for this account. Add email verification if you want a second recovery path."
              : user.isVerified
                ? "Email verification is active and currently satisfies Dotly trust checks for this account. Add mobile OTP next to strengthen recovery and future step-up checks."
                : "Add a verified email or mobile OTP to unlock current trust-sensitive actions. Email verification is available now, and mobile OTP can be added in settings.",
        unlockedActions: requirements
          .filter((requirement) => requirement.unlocked)
          .map((requirement) => requirement.label),
        restrictedActions: requirements
          .filter((requirement) => !requirement.unlocked)
          .map((requirement) => requirement.label),
        requirements,
        trustFactors,
      },
    };
  }

  async getCurrentUserReferral(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        referralCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async clearFirstResponseNudge(userId: string, queue: string) {
    if (!isActivationNudgeQueue(queue)) {
      throw new BadRequestException("Unknown activation queue.");
    }

    await this.activationMilestonesService.clearFirstResponseNudge(
      userId,
      queue,
    );

    return {
      cleared: true,
      queue,
    };
  }

  async resendVerificationEmail(userId: string, context?: AuthActionContext) {
    return (this.authService as any).resendVerificationEmailForCurrentUser(
      userId,
      context,
    );
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    sessionId?: string,
    context?: AuthActionContext,
  ) {
    return (this.authService as any).changePassword(
      userId,
      changePasswordDto,
      sessionId,
      context,
    );
  }

  async requestMobileOtp(
    userId: string,
    requestMobileOtpDto: RequestMobileOtpDto,
    context?: AuthActionContext,
  ) {
    return (this.authService as any).requestMobileOtp(
      userId,
      requestMobileOtpDto,
      context,
    );
  }

  async verifyMobileOtp(
    userId: string,
    verifyMobileOtpDto: VerifyMobileOtpDto,
    context?: AuthActionContext,
  ) {
    return (this.authService as any).verifyMobileOtp(
      userId,
      verifyMobileOtpDto,
      context,
    );
  }

  async listSessions(userId: string, sessionId?: string) {
    return (this.authService as any).listSessions(userId, sessionId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    revokeSessionDto: RevokeSessionDto,
  ) {
    return (this.authService as any).revokeSession(
      userId,
      sessionId,
      revokeSessionDto,
    );
  }

  async revokeOtherSessions(userId: string, sessionId: string) {
    return (this.authService as any).revokeOtherSessions(userId, sessionId);
  }
}
