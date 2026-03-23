export interface PersonaTrustFields {
  emailVerified: boolean;
  phoneVerified: boolean;
  businessVerified?: boolean;
}

export interface PublicPersonaTrustSignals {
  isVerified: boolean;
  isStrongVerified: boolean;
  isBusinessVerified: boolean;
}

export function buildPublicPersonaTrustSignals(
  fields: PersonaTrustFields,
): PublicPersonaTrustSignals {
  const businessVerified = fields.businessVerified ?? false;

  return {
    isVerified:
      fields.emailVerified || fields.phoneVerified || businessVerified,
    isStrongVerified: fields.emailVerified && fields.phoneVerified,
    isBusinessVerified: businessVerified,
  };
}

export interface UserTrustSource {
  isVerified: boolean;
  phoneVerifiedAt?: Date | null;
  businessVerified?: boolean;
}

export interface StoredPersonaTrustState {
  emailVerified: boolean;
  phoneVerified: boolean;
  businessVerified: boolean;
  trustScore: number;
}

export function buildStoredPersonaTrustState(
  user: UserTrustSource,
): StoredPersonaTrustState {
  const emailVerified = user.isVerified;
  const phoneVerified = Boolean(user.phoneVerifiedAt);
  const businessVerified = Boolean(user.businessVerified);

  return {
    emailVerified,
    phoneVerified,
    businessVerified,
    trustScore: (emailVerified ? 40 : 0) + (phoneVerified ? 40 : 0),
  };
}
