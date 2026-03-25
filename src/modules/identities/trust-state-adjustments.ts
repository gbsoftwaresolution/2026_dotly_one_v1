import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { TrustState } from "../../common/enums/trust-state.enum";

import type { TrustStateAdjustmentDefinition } from "./identity.types";
import { PERMISSION_KEYS } from "./permission-keys";

export const TRUST_STATE_ADJUSTMENTS: Record<
  TrustState,
  TrustStateAdjustmentDefinition
> = {
  [TrustState.Unverified]: {
    trustState: TrustState.Unverified,
    mergeMode: "RESTRICTIVE",
    flags: {
      forceRestrictedProfileFields: true,
    },
    permissions: {
      [PERMISSION_KEYS.profile.phoneView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.profile.emailView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.AllowWithLimits,
      },
    },
  },
  [TrustState.BasicVerified]: {
    trustState: TrustState.BasicVerified,
    mergeMode: "PERMISSIVE",
    permissions: {
      [PERMISSION_KEYS.profile.basicView]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.summaryUse]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.ai.replyUse]: {
        effect: PermissionEffect.AllowWithLimits,
      },
    },
  },
  [TrustState.StrongVerified]: {
    trustState: TrustState.StrongVerified,
    mergeMode: "PERMISSIVE",
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.calling.videoStart]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.profile.phoneView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.profile.emailView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
    },
  },
  [TrustState.TrustedByUser]: {
    trustState: TrustState.TrustedByUser,
    mergeMode: "PERMISSIVE",
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.calling.videoStart]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemView]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.vault.itemDownload]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.summaryUse]: {
        effect: PermissionEffect.Allow,
      },
      [PERMISSION_KEYS.ai.replyUse]: {
        effect: PermissionEffect.Allow,
      },
    },
  },
  [TrustState.HighRisk]: {
    trustState: TrustState.HighRisk,
    mergeMode: "RESTRICTIVE",
    flags: {
      disableCalls: true,
      disablePayments: true,
      denyExport: true,
      denyReshare: true,
      aiDisabled: true,
      markAsHighRisk: true,
    },
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemReshare]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.phoneView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.emailView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.summaryUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.replyUse]: { effect: PermissionEffect.Deny },
    },
  },
  [TrustState.Restricted]: {
    trustState: TrustState.Restricted,
    mergeMode: "RESTRICTIVE",
    flags: {
      disableCalls: true,
      disablePayments: true,
      denyExport: true,
      denyReshare: true,
      forceProtectedMediaLimited: true,
    },
    permissions: {
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.mediaPrivacy.export]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemReshare]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.mediaPrivacy.protectedSend]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.profile.phoneView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
      [PERMISSION_KEYS.profile.emailView]: {
        effect: PermissionEffect.AllowWithLimits,
      },
    },
  },
  [TrustState.Blocked]: {
    trustState: TrustState.Blocked,
    mergeMode: "RESTRICTIVE",
    flags: {
      disableCalls: true,
      disablePayments: true,
      denyExport: true,
      denyReshare: true,
      aiDisabled: true,
      markAsHighRisk: true,
    },
    permissions: {
      [PERMISSION_KEYS.messaging.textSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.voiceSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.imageSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.videoSend]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.messaging.documentSend]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.calling.voiceStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.videoStart]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.calling.directRing]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemDownload]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemAttach]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.vault.itemReshare]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.phoneView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.emailView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.profile.fullView]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.actions.bookingRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentRequestCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.paymentExecute]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.actions.supportTicketCreate]: {
        effect: PermissionEffect.Deny,
      },
      [PERMISSION_KEYS.ai.summaryUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.ai.replyUse]: { effect: PermissionEffect.Deny },
      [PERMISSION_KEYS.relationship.block]: { effect: PermissionEffect.Allow },
      [PERMISSION_KEYS.relationship.report]: { effect: PermissionEffect.Allow },
      [PERMISSION_KEYS.relationship.mute]: { effect: PermissionEffect.Allow },
    },
  },
};

export function getTrustStateAdjustmentDefinition(
  trustState: TrustState,
): TrustStateAdjustmentDefinition {
  return TRUST_STATE_ADJUSTMENTS[trustState];
}
