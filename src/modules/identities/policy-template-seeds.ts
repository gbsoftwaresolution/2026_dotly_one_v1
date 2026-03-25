import { ConnectionType } from "../../common/enums/connection-type.enum";
import { IdentityType } from "../../common/enums/identity-type.enum";
import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ConnectionPolicyTemplateLimits,
  ConnectionPolicyTemplatePermissions,
  ConnectionPolicyTemplateSeedDefinition,
} from "./identity.types";
import { CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS } from "./identity.types";
import { PERMISSION_KEYS } from "./permission-keys";

export function validateTemplatePermissions(
  permissions: ConnectionPolicyTemplatePermissions,
): void {
  for (const permissionKey of CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS) {
    const permissionValue = permissions[permissionKey];

    if (!permissionValue || typeof permissionValue !== "object") {
      throw new Error(`Missing required permission key: ${permissionKey}`);
    }

    if (!("effect" in permissionValue)) {
      throw new Error(`Malformed permission value for key: ${permissionKey}`);
    }
  }
}

function buildPermissions(
  defaults: ConnectionPolicyTemplatePermissions,
  overrides: Partial<ConnectionPolicyTemplatePermissions>,
): ConnectionPolicyTemplatePermissions {
  return {
    ...defaults,
    ...overrides,
  };
}

function createAllPermissions(
  effect: PermissionEffect,
): ConnectionPolicyTemplatePermissions {
  return Object.fromEntries(
    CORE_CONNECTION_TEMPLATE_PERMISSION_KEYS.map((permissionKey) => [
      permissionKey,
      { effect },
    ]),
  ) as ConnectionPolicyTemplatePermissions;
}

function withLimits(
  effect: PermissionEffect,
  limits: ConnectionPolicyTemplateLimits,
) {
  return {
    effect,
    limits,
  };
}

const denyAll = createAllPermissions(PermissionEffect.Deny);
const requestAll = createAllPermissions(PermissionEffect.RequestApproval);
const allowAll = createAllPermissions(PermissionEffect.Allow);

const genericUnknownPermissions = buildPermissions(denyAll, {
  [PERMISSION_KEYS.messaging.textSend]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.profile.basicView]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      requiresMutualConsent: true,
    },
  ),
  [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.mute]: { effect: PermissionEffect.Allow },
});

const genericRequestedPermissions = buildPermissions(requestAll, {
  [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
  [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
  [PERMISSION_KEYS.calling.directRing]: { effect: PermissionEffect.Deny },
  [PERMISSION_KEYS.profile.basicView]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      requiresMutualConsent: true,
    },
  ),
  [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.mute]: { effect: PermissionEffect.Allow },
});

const genericKnownPermissions = buildPermissions(requestAll, {
  [PERMISSION_KEYS.messaging.textSend]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.messaging.voiceSend]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.messaging.imageSend]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.messaging.videoSend]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.messaging.documentSend]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.calling.voiceStart]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.calling.videoStart]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.calling.directRing]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.mediaPrivacy.protectedSend]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      allowsProtectedMode: true,
      watermarkRequired: true,
    },
  ),
  [PERMISSION_KEYS.mediaPrivacy.download]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.mediaPrivacy.forward]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.mediaPrivacy.export]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.vault.itemAttach]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      requiresMutualConsent: true,
    },
  ),
  [PERMISSION_KEYS.vault.itemView]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      requiresMutualConsent: true,
    },
  ),
  [PERMISSION_KEYS.profile.basicView]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.profile.fullView]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.profile.phoneView]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.profile.emailView]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.actions.bookingRequestCreate]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.actions.paymentRequestCreate]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      requiresMutualConsent: true,
    },
  ),
  [PERMISSION_KEYS.actions.supportTicketCreate]: {
    effect: PermissionEffect.Allow,
  },
  [PERMISSION_KEYS.ai.summaryUse]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.ai.replyUse]: {
    effect: PermissionEffect.RequestApproval,
  },
  [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.mute]: { effect: PermissionEffect.Allow },
});

const genericTrustedPermissions = buildPermissions(allowAll, {
  [PERMISSION_KEYS.mediaPrivacy.forward]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      watermarkRequired: true,
    },
  ),
  [PERMISSION_KEYS.mediaPrivacy.export]: withLimits(
    PermissionEffect.AllowWithLimits,
    {
      watermarkRequired: true,
      exportAllowed: true,
    },
  ),
});

const genericBlockedPermissions = buildPermissions(denyAll, {
  [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
  [PERMISSION_KEYS.relationship.mute]: { effect: PermissionEffect.Allow },
});

function createTemplate(
  definition: Omit<
    ConnectionPolicyTemplateSeedDefinition,
    "policyVersion" | "isSystem" | "isActive"
  >,
): ConnectionPolicyTemplateSeedDefinition {
  return {
    ...definition,
    policyVersion: 1,
    isSystem: true,
    isActive: true,
  };
}

export const CONNECTION_POLICY_TEMPLATE_SEEDS: readonly ConnectionPolicyTemplateSeedDefinition[] =
  [
    createTemplate({
      sourceIdentityType: null,
      connectionType: ConnectionType.Unknown,
      templateKey: "generic.unknown",
      displayName: "Generic Unknown",
      description: "Fallback template for unknown relationships.",
      permissions: genericUnknownPermissions,
      limits: {
        requiresMutualConsent: true,
        allowsProtectedMode: false,
      },
    }),
    createTemplate({
      sourceIdentityType: null,
      connectionType: ConnectionType.Requested,
      templateKey: "generic.requested",
      displayName: "Generic Requested",
      description: "Default template for requested relationships.",
      permissions: genericRequestedPermissions,
      limits: {
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: null,
      connectionType: ConnectionType.Known,
      templateKey: "generic.known",
      displayName: "Generic Known",
      description: "Default template for known relationships.",
      permissions: genericKnownPermissions,
      limits: {
        allowsProtectedMode: true,
        watermarkRequired: true,
      },
    }),
    createTemplate({
      sourceIdentityType: null,
      connectionType: ConnectionType.Trusted,
      templateKey: "generic.trusted",
      displayName: "Generic Trusted",
      description: "Default template for trusted relationships.",
      permissions: genericTrustedPermissions,
      limits: {
        exportAllowed: true,
        aiDefaultEnabled: true,
        allowsProtectedMode: true,
      },
    }),
    createTemplate({
      sourceIdentityType: null,
      connectionType: ConnectionType.Blocked,
      templateKey: "generic.blocked",
      displayName: "Generic Blocked",
      description: "System template for blocked relationships.",
      permissions: genericBlockedPermissions,
      limits: {
        exportAllowed: false,
        aiDefaultEnabled: false,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Known,
      templateKey: "personal.known",
      displayName: "Personal Known",
      description: "Personal defaults for known contacts.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.profile.fullView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.profile.phoneView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.profile.emailView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        requiresMutualConsent: true,
        allowsProtectedMode: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Trusted,
      templateKey: "personal.trusted",
      displayName: "Personal Trusted",
      description: "Personal defaults for trusted contacts.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        allowsProtectedMode: true,
        watermarkRequired: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.InnerCircle,
      templateKey: "personal.inner_circle",
      displayName: "Personal Inner Circle",
      description: "Closer defaults for inner-circle personal contacts.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.profile.fullView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.profile.phoneView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.profile.emailView]: { effect: PermissionEffect.Allow },
      }),
      limits: {
        allowsProtectedMode: true,
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Family,
      templateKey: "personal.family",
      displayName: "Personal Family",
      description: "Family defaults for personal identities.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.vault.itemView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.vault.itemDownload]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        allowsProtectedMode: true,
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Personal,
      connectionType: ConnectionType.Partner,
      templateKey: "personal.partner",
      displayName: "Personal Partner",
      description:
        "High-trust personal partner defaults with privacy guardrails.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.mediaPrivacy.forward]: {
          effect: PermissionEffect.Deny,
        },
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.Deny,
        },
        [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
          effect: PermissionEffect.Allow,
        },
      }),
      limits: {
        allowsProtectedMode: true,
        watermarkRequired: true,
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Professional,
      connectionType: ConnectionType.Colleague,
      templateKey: "professional.colleague",
      displayName: "Professional Colleague",
      description: "Professional defaults for colleague relationships.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.profile.phoneView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.profile.emailView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        requiresCallScheduling: false,
        aiDefaultEnabled: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Professional,
      connectionType: ConnectionType.Client,
      templateKey: "professional.client",
      displayName: "Professional Client",
      description: "Professional defaults for client relationships.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.actions.bookingRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
      }),
      limits: {
        requiresCallScheduling: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Professional,
      connectionType: ConnectionType.Vendor,
      templateKey: "professional.vendor",
      displayName: "Professional Vendor",
      description: "Professional defaults for vendor relationships.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.RequestApproval,
        },
      }),
      limits: {
        requiresCallScheduling: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Known,
      templateKey: "business.known",
      displayName: "Business Known",
      description: "Business defaults for known relationships.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
      }),
      limits: {
        requiresCallScheduling: true,
        aiDefaultEnabled: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Client,
      templateKey: "business.client",
      displayName: "Business Client",
      description: "Business client defaults with stronger commerce actions.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.actions.bookingRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.profile.fullView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        requiresCallScheduling: true,
        aiDefaultEnabled: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.VerifiedBusiness,
      templateKey: "business.verified_business",
      displayName: "Business Verified Business",
      description: "Higher trust business-to-business defaults.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.actions.bookingRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.Allow,
        },
      }),
      limits: {
        exportAllowed: true,
        aiDefaultEnabled: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Business,
      connectionType: ConnectionType.Vendor,
      templateKey: "business.vendor",
      displayName: "Business Vendor",
      description: "Business defaults for vendor relationships.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.actions.supportTicketCreate]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.actions.paymentRequestCreate]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        requiresCallScheduling: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Couple,
      connectionType: ConnectionType.Partner,
      templateKey: "couple.partner",
      displayName: "Couple Partner",
      description:
        "High-trust couple partner defaults with strict privacy controls.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.Deny,
        },
        [PERMISSION_KEYS.vault.itemReshare]: { effect: PermissionEffect.Deny },
        [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.mediaPrivacy.forward]: {
          effect: PermissionEffect.Deny,
        },
      }),
      limits: {
        allowsProtectedMode: true,
        requiresMutualConsent: true,
        exportAllowed: false,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Couple,
      connectionType: ConnectionType.Family,
      templateKey: "couple.family",
      displayName: "Couple Family",
      description: "Couple defaults when connecting to family identities.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.vault.itemView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.Deny,
        },
      }),
      limits: {
        requiresMutualConsent: true,
        exportAllowed: false,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Couple,
      connectionType: ConnectionType.Trusted,
      templateKey: "couple.trusted",
      displayName: "Couple Trusted",
      description: "Trusted defaults for couple identities.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.mediaPrivacy.export]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.Deny,
        },
      }),
      limits: {
        requiresMutualConsent: true,
        allowsProtectedMode: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Family,
      connectionType: ConnectionType.Family,
      templateKey: "family.family",
      displayName: "Family Family",
      description: "Family identity defaults for family relationships.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.vault.itemView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.vault.itemDownload]: {
          effect: PermissionEffect.Allow,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.profile.fullView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.profile.phoneView]: { effect: PermissionEffect.Allow },
        [PERMISSION_KEYS.profile.emailView]: { effect: PermissionEffect.Allow },
      }),
      limits: {
        exportAllowed: false,
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Family,
      connectionType: ConnectionType.Trusted,
      templateKey: "family.trusted",
      displayName: "Family Trusted",
      description: "Trusted defaults for family identities.",
      permissions: buildPermissions(genericTrustedPermissions, {
        [PERMISSION_KEYS.vault.itemView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.vault.itemReshare]: {
          effect: PermissionEffect.Deny,
        },
      }),
      limits: {
        requiresMutualConsent: true,
      },
    }),
    createTemplate({
      sourceIdentityType: IdentityType.Family,
      connectionType: ConnectionType.Known,
      templateKey: "family.known",
      displayName: "Family Known",
      description: "Known defaults for family identities.",
      permissions: buildPermissions(genericKnownPermissions, {
        [PERMISSION_KEYS.profile.fullView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
        [PERMISSION_KEYS.vault.itemView]: {
          effect: PermissionEffect.AllowWithLimits,
        },
      }),
      limits: {
        requiresMutualConsent: true,
      },
    }),
  ] as const;

export function resolveTemplateKeyCandidates(
  sourceIdentityType: IdentityType | null,
  connectionType: ConnectionType,
): string[] {
  const normalizedConnectionType = connectionType;

  if (sourceIdentityType === null) {
    return [`generic.${normalizedConnectionType}`];
  }

  return [
    `${sourceIdentityType}.${normalizedConnectionType}`,
    `generic.${normalizedConnectionType}`,
  ];
}
