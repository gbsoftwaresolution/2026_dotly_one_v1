import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  AnalyticsService,
  noopAnalyticsService,
} from "../analytics/analytics.service";

export type TrustFactor = "email_verified" | "mobile_otp_verified";

export type VerificationRequirement =
  | "send_contact_request"
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

const VERIFICATION_POLICY: Record<
  VerificationRequirement,
  TrustRequirementDefinition
> = {
  send_contact_request: {
    label: "Send contact requests",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before sending connection requests. Check your inbox for the verification link, or resend it.",
  },
  create_profile_qr: {
    label: "Create profile QR codes",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before creating shareable profile QR codes. Check your inbox for the verification link, or resend it.",
  },
  create_quick_connect_qr: {
    label: "Create Quick Connect QR codes",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before creating Quick Connect QR codes. Check your inbox for the verification link, or resend it.",
  },
  create_event: {
    label: "Create trust-based events",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before creating trust-based events. Check your inbox for the verification link, or resend it.",
  },
  join_event: {
    label: "Join event networking",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before joining Dotly event networking. Check your inbox for the verification link, or resend it.",
  },
  enable_event_discovery: {
    label: "Enable event discovery",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before enabling event discovery. Check your inbox for the verification link, or resend it.",
  },
  view_event_participants: {
    label: "View discoverable participants",
    anyOf: ["email_verified", "mobile_otp_verified"],
    message:
      "Verify your email before viewing participants in Dotly event discovery. Check your inbox for the verification link, or resend it.",
  },
};

@Injectable()
export class VerificationPolicyService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly analyticsService: AnalyticsService =
      noopAnalyticsService as AnalyticsService,
  ) {}

  async assertUserMeetsRequirement(
    userId: string,
    requirement: VerificationRequirement,
  ) {
    const trustState = await this.getUserTrustState(userId);
    const evaluation = this.evaluateRequirement(requirement, trustState);

    if (!evaluation.satisfied) {
      await this.analyticsService.trackVerificationBlockedAction({
        actorUserId: userId,
        requirement,
        allowedFactors: evaluation.allowedFactors,
        missingFactors: evaluation.missingFactors,
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
      available: factor === "email_verified",
      source: metadata.source,
    }));
  }

  getRequirementMessage(requirement: VerificationRequirement): string {
    return VERIFICATION_POLICY[requirement].message;
  }

  private async getUserTrustState(userId: string): Promise<UserTrustState> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      userId: user.id,
      factors: {
        email_verified: user.isVerified,
        mobile_otp_verified: false,
      },
    };
  }

  private evaluateRequirement(
    requirement: VerificationRequirement,
    trustState: UserTrustState,
  ) {
    const definition = VERIFICATION_POLICY[requirement];
    const satisfied = definition.anyOf.some((factor) => trustState.factors[factor]);

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