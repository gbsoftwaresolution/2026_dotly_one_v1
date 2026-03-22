import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { CacheService } from "../../infrastructure/cache/cache.service";

export type AuthActionContext = {
  requestId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string | null;
};

export type AuthThrottleDecision = {
  reason:
    | "account_lockout"
    | "account_ip_lockout"
    | "ip_lockout"
    | "email_rate_limited"
    | "ip_rate_limited"
    | "session_rate_limited"
    | "phone_rate_limited";
  dimension: "account" | "account_ip" | "email" | "ip" | "phone" | "session";
  policyName: string;
  riskLevel: "standard" | "elevated";
  challengeRecommended: boolean;
};

type WindowPolicy = {
  policyName: string;
  dimension: AuthThrottleDecision["dimension"];
  reason: Extract<
    AuthThrottleDecision["reason"],
    "email_rate_limited" | "ip_rate_limited" | "session_rate_limited" | "phone_rate_limited"
  >;
  windowMs: number;
  limit: number;
  riskLevel?: AuthThrottleDecision["riskLevel"];
  challengeRecommended?: boolean;
};

type FailureLockoutPolicy = {
  policyName: string;
  dimension: Extract<
    AuthThrottleDecision["dimension"],
    "account" | "account_ip" | "ip"
  >;
  reason: Extract<
    AuthThrottleDecision["reason"],
    "account_lockout" | "account_ip_lockout" | "ip_lockout"
  >;
  windowMs: number;
  threshold: number;
  lockoutMs: number;
  riskLevel?: AuthThrottleDecision["riskLevel"];
  challengeRecommended?: boolean;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// These policies are centralized so future risk controls like CAPTCHA,
// device reputation, or provider-aware step-up checks can reuse the same hooks.
const LOGIN_FAILURE_LOCKOUT_POLICIES: readonly FailureLockoutPolicy[] = [
  {
    policyName: "auth.login.failure.account",
    dimension: "account",
    reason: "account_lockout",
    windowMs: 15 * MINUTE_MS,
    threshold: 5,
    lockoutMs: 15 * MINUTE_MS,
  },
  {
    policyName: "auth.login.failure.ip",
    dimension: "ip",
    reason: "ip_lockout",
    windowMs: 15 * MINUTE_MS,
    threshold: 12,
    lockoutMs: 15 * MINUTE_MS,
  },
  {
    policyName: "auth.login.failure.account_ip",
    dimension: "account_ip",
    reason: "account_ip_lockout",
    windowMs: 15 * MINUTE_MS,
    threshold: 7,
    lockoutMs: 30 * MINUTE_MS,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const SIGNUP_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.signup.email",
    dimension: "email",
    reason: "email_rate_limited",
    windowMs: HOUR_MS,
    limit: 3,
  },
  {
    policyName: "auth.signup.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 8,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const PASSWORD_RESET_REQUEST_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.password_reset.request.email",
    dimension: "email",
    reason: "email_rate_limited",
    windowMs: HOUR_MS,
    limit: 6,
  },
  {
    policyName: "auth.password_reset.request.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 12,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const PASSWORD_RESET_COMPLETE_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.password_reset.complete.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 12,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const EMAIL_VERIFICATION_RESEND_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.email_verification.resend.email",
    dimension: "email",
    reason: "email_rate_limited",
    windowMs: HOUR_MS,
    limit: 6,
  },
  {
    policyName: "auth.email_verification.resend.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 10,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
  {
    policyName: "auth.email_verification.resend.session",
    dimension: "session",
    reason: "session_rate_limited",
    windowMs: HOUR_MS,
    limit: 6,
  },
] as const;

const EMAIL_VERIFICATION_COMPLETE_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.email_verification.complete.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 20,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const MOBILE_OTP_REQUEST_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.mobile_otp.request.phone",
    dimension: "phone",
    reason: "phone_rate_limited",
    windowMs: HOUR_MS,
    limit: 6,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
  {
    policyName: "auth.mobile_otp.request.session",
    dimension: "session",
    reason: "session_rate_limited",
    windowMs: HOUR_MS,
    limit: 6,
  },
  {
    policyName: "auth.mobile_otp.request.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 10,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

const MOBILE_OTP_VERIFY_POLICIES: readonly WindowPolicy[] = [
  {
    policyName: "auth.mobile_otp.verify.session",
    dimension: "session",
    reason: "session_rate_limited",
    windowMs: HOUR_MS,
    limit: 12,
  },
  {
    policyName: "auth.mobile_otp.verify.ip",
    dimension: "ip",
    reason: "ip_rate_limited",
    windowMs: HOUR_MS,
    limit: 20,
    riskLevel: "elevated",
    challengeRecommended: true,
  },
] as const;

@Injectable()
export class AuthAbuseProtectionService {
  constructor(private readonly cacheService: CacheService) {}

  async getLoginThrottle(
    email: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    const identifiers = this.buildLoginIdentifiers(email, context);

    for (const policy of [
      LOGIN_FAILURE_LOCKOUT_POLICIES[2],
      LOGIN_FAILURE_LOCKOUT_POLICIES[0],
      LOGIN_FAILURE_LOCKOUT_POLICIES[1],
    ]) {
      const identifier = identifiers[policy.dimension];

      if (!identifier) {
        continue;
      }

      const lockValue = await this.cacheService.get(
        this.buildLockKey(policy.policyName, identifier),
      );

      if (lockValue) {
        return this.toDecision(policy);
      }
    }

    return null;
  }

  async recordLoginFailure(
    email: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    const identifiers = this.buildLoginIdentifiers(email, context);
    let elevatedDecision: AuthThrottleDecision | null = null;

    for (const policy of LOGIN_FAILURE_LOCKOUT_POLICIES) {
      const identifier = identifiers[policy.dimension];

      if (!identifier) {
        continue;
      }

      const count = await this.cacheService.increment(
        this.buildWindowKey(policy.policyName, identifier),
        Math.ceil(policy.windowMs / 1000),
      );

      if (typeof count !== "number" || count < policy.threshold) {
        continue;
      }

      await this.cacheService.setIfAbsent(
        this.buildLockKey(policy.policyName, identifier),
        "1",
        Math.ceil(policy.lockoutMs / 1000),
      );

      const decision = this.toDecision(policy);

      if (
        !elevatedDecision ||
        decision.riskLevel === "elevated" ||
        decision.dimension === "account"
      ) {
        elevatedDecision = decision;
      }
    }

    return elevatedDecision;
  }

  async consumeSignupAttempt(
    email: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(SIGNUP_POLICIES, {
      email,
      ipAddress: context?.ipAddress,
    });
  }

  async consumePasswordResetRequest(
    email: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(PASSWORD_RESET_REQUEST_POLICIES, {
      email,
      ipAddress: context?.ipAddress,
    });
  }

  async consumePasswordResetCompletion(
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(PASSWORD_RESET_COMPLETE_POLICIES, {
      ipAddress: context?.ipAddress,
    });
  }

  async consumeVerificationResend(
    email: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(EMAIL_VERIFICATION_RESEND_POLICIES, {
      email,
      ipAddress: context?.ipAddress,
      sessionId: context?.sessionId,
    });
  }

  async consumeVerificationCompletion(
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(EMAIL_VERIFICATION_COMPLETE_POLICIES, {
      ipAddress: context?.ipAddress,
    });
  }

  async consumeMobileOtpRequest(
    phoneNumber: string,
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(MOBILE_OTP_REQUEST_POLICIES, {
      phoneNumber,
      sessionId: context?.sessionId,
      ipAddress: context?.ipAddress,
    });
  }

  async consumeMobileOtpVerification(
    context?: AuthActionContext,
  ): Promise<AuthThrottleDecision | null> {
    return this.consumeWindowPolicies(MOBILE_OTP_VERIFY_POLICIES, {
      sessionId: context?.sessionId,
      ipAddress: context?.ipAddress,
    });
  }

  private async consumeWindowPolicies(
    policies: readonly WindowPolicy[],
    identifiers: {
      email?: string | null;
      ipAddress?: string | null;
      phoneNumber?: string | null;
      sessionId?: string | null;
    },
  ): Promise<AuthThrottleDecision | null> {
    for (const policy of policies) {
      const identifier =
        policy.dimension === "email"
          ? identifiers.email
          : policy.dimension === "ip"
            ? identifiers.ipAddress
            : policy.dimension === "phone"
              ? identifiers.phoneNumber
              : identifiers.sessionId;

      if (!identifier) {
        continue;
      }

      const count = await this.cacheService.increment(
        this.buildWindowKey(policy.policyName, identifier),
        Math.ceil(policy.windowMs / 1000),
      );

      if (typeof count === "number" && count > policy.limit) {
        return this.toDecision(policy);
      }
    }

    return null;
  }

  private buildLoginIdentifiers(email: string, context?: AuthActionContext) {
    return {
      account: email,
      ip: context?.ipAddress ?? null,
      account_ip:
        context?.ipAddress && email ? `${email}|${context.ipAddress}` : null,
    } as const;
  }

  private toDecision(
    policy: WindowPolicy | FailureLockoutPolicy,
  ): AuthThrottleDecision {
    return {
      reason: policy.reason,
      dimension: policy.dimension,
      policyName: policy.policyName,
      riskLevel: policy.riskLevel ?? "standard",
      challengeRecommended: policy.challengeRecommended ?? false,
    };
  }

  private buildWindowKey(policyName: string, rawIdentifier: string): string {
    return `auth-abuse:window:${policyName}:${this.hashIdentifier(rawIdentifier)}`;
  }

  private buildLockKey(policyName: string, rawIdentifier: string): string {
    return `auth-abuse:lock:${policyName}:${this.hashIdentifier(rawIdentifier)}`;
  }

  private hashIdentifier(rawIdentifier: string): string {
    return createHash("sha256")
      .update(rawIdentifier.trim().toLowerCase())
      .digest("hex")
      .slice(0, 24);
  }
}