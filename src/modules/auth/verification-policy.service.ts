import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  SecurityAuditService,
  noopSecurityAuditService,
} from "../../infrastructure/logging/security-audit.service";
import {
  AnalyticsService,
  noopAnalyticsService,
} from "../analytics/analytics.service";
import {
  AuthMetricsService,
  noopAuthMetricsService,
} from "./auth-metrics.service";

export type TrustFactor = "email_verified" | "mobile_otp_verified";

export interface TrustFactorSourceUser {
  isVerified: boolean;
  phoneVerifiedAt?: Date | null;
}

export type VerificationRequirement =
  | "send_contact_request"
  | "instant_connect"
  | "create_profile_qr"
  | "create_quick_connect_qr"
  | "create_event"
  | "join_event"
  | "enable_event_discovery"
  | "view_event_participants";

interface TrustRequirementDefinition {
  label: string;
  anyOf: TrustFactor[];
  message: string;
}

interface UserTrustState {
  userId: string;
  factors: Record<TrustFactor, boolean>;
}

const TRUST_FACTOR_CATALOG: Record<TrustFactor, { source: string }> = {
  email_verified: {
    source: "email",
  },
  mobile_otp_verified: {
    source: "mobile_otp",
  },
};

export function buildUserTrustFactors(
  user: TrustFactorSourceUser,
): Record<TrustFactor, boolean> {
  return {
    email_verified: user.isVerified,
    mobile_otp_verified: Boolean(user.phoneVerifiedAt),
  };
}

export function isTrustRequirementSatisfied(
  requiredFactors: readonly TrustFactor[],
  factors: Record<TrustFactor, boolean>,
): boolean {
  return requiredFactors.some((factor) => factors[factor]);
}

export function userHasActiveTrustFactor(user: TrustFactorSourceUser): boolean {
  return isTrustRequirementSatisfied(
    Object.keys(TRUST_FACTOR_CATALOG) as TrustFactor[],
    buildUserTrustFactors(user),
  );
}

const VERIFICATION_POLICY: Record<
  VerificationRequirement,
  TrustRequirementDefinition
> = {
  send_contact_request: {
    label: "Send contact requests",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before sending connection requests.",
  },
  instant_connect: {
    label: "Use instant connect",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before using instant connect.",
  },
  create_profile_qr: {
    label: "Create profile QR codes",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before creating shareable profile QR codes.",
  },
  create_quick_connect_qr: {
    label: "Create Quick Connect QR codes",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before creating Quick Connect QR codes.",
  },
  create_event: {
    label: "Create trust-based events",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before creating trust-based events.",
  },
  join_event: {
    label: "Join event networking",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before joining Dotly event networking.",
  },
  enable_event_discovery: {
    label: "Enable event discovery",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before enabling event discovery.",
  },
  view_event_participants: {
    label: "View discoverable participants",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email or complete mobile OTP before viewing participants in Dotly event discovery.",
  },
};

@Injectable()
export class VerificationPolicyService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly analyticsService: AnalyticsService = noopAnalyticsService as AnalyticsService,
    @Optional()
    private readonly securityAuditService: Pick<SecurityAuditService, "log"> =
      noopSecurityAuditService,
    @Optional()
    private readonly authMetricsService: AuthMetricsService = noopAuthMetricsService,
  ) {}

  async assertUserMeetsRequirement(
    userId: string,
    requirement: VerificationRequirement,
  ) {
    const trustState = await this.getUserTrustState(userId);
    const evaluation = this.evaluateRequirement(requirement, trustState);

    if (!evaluation.satisfied) {
      this.authMetricsService.recordTrustSensitiveActionBlocked(requirement);

      await this.analyticsService.trackVerificationBlockedAction({
        actorUserId: userId,
        requirement,
        allowedFactors: evaluation.allowedFactors,
        missingFactors: evaluation.missingFactors,
      });

      this.securityAuditService.log({
        action: "auth.verification_requirement.enforcement",
        outcome: "blocked",
        actorUserId: userId,
        reason: requirement,
        policySource: "verification_policy",
        metadata: {
          allowedFactors: evaluation.allowedFactors,
          missingFactors: evaluation.missingFactors,
        },
      });

      throw new ForbiddenException(evaluation.message);
    }
  }

  async assertUserIsVerified(
    userId: string,
    requirement: VerificationRequirement,
  ) {
    return this.assertUserMeetsRequirement(userId, requirement);
  }

  async getRequirementStatus(
    userId: string,
    requirement: VerificationRequirement,
  ) {
    const trustState = await this.getUserTrustState(userId);
    return this.evaluateRequirement(requirement, trustState);
  }

  getRequirementCatalog() {
    return VERIFICATION_POLICY;
  }

  getAvailableTrustFactors() {
    return Object.entries(TRUST_FACTOR_CATALOG).map(([factor, metadata]) => ({
      factor: factor as TrustFactor,
      available: true,
      source: metadata.source,
    }));
  }

  getRequirementMessage(requirement: VerificationRequirement): string {
    return VERIFICATION_POLICY[requirement].message;
  }

  private async getUserTrustState(userId: string): Promise<UserTrustState> {
    const user = await (this.prismaService as any).user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isVerified: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      userId: user.id,
      factors: buildUserTrustFactors(user),
    };
  }

  private evaluateRequirement(
    requirement: VerificationRequirement,
    trustState: UserTrustState,
  ) {
    const definition = VERIFICATION_POLICY[requirement];
    const satisfied = isTrustRequirementSatisfied(
      definition.anyOf,
      trustState.factors,
    );

    return {
      requirement,
      label: definition.label,
      message: definition.message,
      satisfied,
      allowedFactors: definition.anyOf,
      missingFactors: definition.anyOf.filter(
        (factor) => !trustState.factors[factor],
      ),
    };
  }
}
