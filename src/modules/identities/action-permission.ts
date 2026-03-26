import type { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ContentActionKey,
  ConversationStatus,
  ConversationType,
  IdentityBehaviorRuleSummary,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";
import { PERMISSION_KEYS } from "./permission-keys";

export enum ActionType {
  SendText = "SEND_TEXT",
  SendVoice = "SEND_VOICE",
  SendImage = "SEND_IMAGE",
  SendVideo = "SEND_VIDEO",
  SendDocument = "SEND_DOCUMENT",
  SendLink = "SEND_LINK",
  SendLocation = "SEND_LOCATION",
  StartVoiceCall = "START_VOICE_CALL",
  StartVideoCall = "START_VIDEO_CALL",
  SendProtectedMedia = "SEND_PROTECTED_MEDIA",
  DownloadMedia = "DOWNLOAD_MEDIA",
  ForwardMedia = "FORWARD_MEDIA",
  ExportMedia = "EXPORT_MEDIA",
  ViewContent = "VIEW_CONTENT",
  DownloadContent = "DOWNLOAD_CONTENT",
  ForwardContent = "FORWARD_CONTENT",
  ExportContent = "EXPORT_CONTENT",
  AiSummary = "AI_SUMMARY",
  AiReply = "AI_REPLY",
}

export enum ActionDecisionEffect {
  Allow = "ALLOW",
  Deny = "DENY",
  RequestApproval = "REQUEST_APPROVAL",
  AllowWithLimits = "ALLOW_WITH_LIMITS",
}

export type ActionDecisionReasonCode =
  | "ACTION_ALLOWED"
  | "ACTION_DENIED_PERMISSION"
  | "ACTION_DENIED_CONTENT_RULE"
  | "ACTION_DENIED_RISK"
  | "ACTION_DENIED_CONVERSATION_STATE"
  | "ACTION_REQUEST_APPROVAL"
  | "ACTION_ALLOWED_WITH_LIMITS"
  | "ACTION_INVALID_ACTOR";

export interface ActionDecision {
  allowed: boolean;
  effect: ActionDecisionEffect;
  actionType: ActionType | string;
  permissionKey: PermissionKey | null;
  conversationId: string;
  actorIdentityId: string;
  reasonCode: ActionDecisionReasonCode;
  reasons: string[];
  trace?: {
    staleBinding: boolean;
    conversationStatus: ConversationStatus | null;
    conversationType: ConversationType | null;
    baseEffect: PermissionEffect | null;
    contentEffect: PermissionEffect | null;
    contentAction: ContentActionKey | null;
    identityBehaviorApplied?: boolean;
    identityBehaviorReasonCodes?: string[];
    identityBehaviorSummary?: IdentityBehaviorRuleSummary | null;
  };
  evaluatedAt: Date;
}

export interface ActionPermissionDefinition {
  permissionKey: PermissionKey;
  contentAction: ContentActionKey | null;
  category: "MESSAGING" | "CALL" | "MEDIA" | "CONTENT" | "AI";
}

export const ACTION_PERMISSION_MAP: Record<
  ActionType,
  ActionPermissionDefinition
> = {
  [ActionType.SendText]: {
    permissionKey: PERMISSION_KEYS.messaging.textSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendVoice]: {
    permissionKey: PERMISSION_KEYS.messaging.voiceSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendImage]: {
    permissionKey: PERMISSION_KEYS.messaging.imageSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendVideo]: {
    permissionKey: PERMISSION_KEYS.messaging.videoSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendDocument]: {
    permissionKey: PERMISSION_KEYS.messaging.documentSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendLink]: {
    permissionKey: PERMISSION_KEYS.messaging.linkSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.SendLocation]: {
    permissionKey: PERMISSION_KEYS.messaging.locationSend,
    contentAction: null,
    category: "MESSAGING",
  },
  [ActionType.StartVoiceCall]: {
    permissionKey: PERMISSION_KEYS.calling.voiceStart,
    contentAction: null,
    category: "CALL",
  },
  [ActionType.StartVideoCall]: {
    permissionKey: PERMISSION_KEYS.calling.videoStart,
    contentAction: null,
    category: "CALL",
  },
  [ActionType.SendProtectedMedia]: {
    permissionKey: PERMISSION_KEYS.mediaPrivacy.protectedSend,
    contentAction: null,
    category: "MEDIA",
  },
  [ActionType.DownloadMedia]: {
    permissionKey: PERMISSION_KEYS.mediaPrivacy.download,
    contentAction: "content.download",
    category: "MEDIA",
  },
  [ActionType.ForwardMedia]: {
    permissionKey: PERMISSION_KEYS.mediaPrivacy.forward,
    contentAction: "content.forward",
    category: "MEDIA",
  },
  [ActionType.ExportMedia]: {
    permissionKey: PERMISSION_KEYS.mediaPrivacy.export,
    contentAction: "content.export",
    category: "MEDIA",
  },
  [ActionType.ViewContent]: {
    permissionKey: PERMISSION_KEYS.vault.itemView,
    contentAction: "content.view",
    category: "CONTENT",
  },
  [ActionType.DownloadContent]: {
    permissionKey: PERMISSION_KEYS.vault.itemDownload,
    contentAction: "content.download",
    category: "CONTENT",
  },
  [ActionType.ForwardContent]: {
    permissionKey: PERMISSION_KEYS.vault.itemReshare,
    contentAction: "content.forward",
    category: "CONTENT",
  },
  [ActionType.ExportContent]: {
    permissionKey: PERMISSION_KEYS.mediaPrivacy.export,
    contentAction: "content.export",
    category: "CONTENT",
  },
  [ActionType.AiSummary]: {
    permissionKey: PERMISSION_KEYS.ai.summaryUse,
    contentAction: null,
    category: "AI",
  },
  [ActionType.AiReply]: {
    permissionKey: PERMISSION_KEYS.ai.replyUse,
    contentAction: null,
    category: "AI",
  },
};

export function getActionPermissionDefinition(
  actionType: ActionType | string,
): ActionPermissionDefinition | null {
  return ACTION_PERMISSION_MAP[actionType as ActionType] ?? null;
}
