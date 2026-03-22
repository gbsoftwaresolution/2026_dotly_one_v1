export interface PersonaTrustFields {
  emailVerified: boolean;
  phoneVerified: boolean;
  businessVerified: boolean;
  trustScore?: number | null;
}

export interface PublicPersonaTrustSignals {
  isVerified: boolean;
  isStrongVerified: boolean;
  isBusinessVerified: boolean;
}

const PERSONA_TRUST_WEIGHTS = {
  emailVerified: 40,
  phoneVerified: 40,
  businessVerified: 20,
} as const;

export function buildPublicPersonaTrustSignals(
  fields: Pick<
    PersonaTrustFields,
    "emailVerified" | "phoneVerified" | "businessVerified"
  >,
): PublicPersonaTrustSignals {
  return {
    isVerified: fields.emailVerified || fields.phoneVerified,
    isStrongVerified: fields.emailVerified && fields.phoneVerified,
    isBusinessVerified: fields.businessVerified,
  };
}

export function calculatePersonaTrustScore(
  fields: Pick<
    PersonaTrustFields,
    "emailVerified" | "phoneVerified" | "businessVerified"
  >,
): number {
  let score = 0;

  if (fields.emailVerified) {
    score += PERSONA_TRUST_WEIGHTS.emailVerified;
  }

  if (fields.phoneVerified) {
    score += PERSONA_TRUST_WEIGHTS.phoneVerified;
  }

  if (fields.businessVerified) {
    score += PERSONA_TRUST_WEIGHTS.businessVerified;
  }

  return Math.max(0, Math.min(100, score));
}

export function buildPersonaTrustState(fields: PersonaTrustFields) {
  return {
    publicTrust: buildPublicPersonaTrustSignals(fields),
    trustScore: fields.trustScore ?? calculatePersonaTrustScore(fields),
  };
}