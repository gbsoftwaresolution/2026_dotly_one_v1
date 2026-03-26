import { PermissionEffect } from "../types/connection";
import { PermissionCategory, PermissionControlMetadata, UIState } from "../types/permissions";

/**
 * Maps the backend PermissionEffect enum to human-readable UI states.
 */
export const effectToUIState = (effect: PermissionEffect): UIState => {
  switch (effect) {
    case PermissionEffect.Allow:
      return "Allowed";
    case PermissionEffect.RequestApproval:
      return "Needs approval";
    case PermissionEffect.AllowWithLimits:
      return "Limited";
    case PermissionEffect.Deny:
      return "Blocked";
    default:
      return "Blocked"; // Safe default
  }
};

/**
 * The single source of truth for permission keys mapped to user-facing UI labels and categories.
 * This prevents scatter strings and handles domain logic for what controls to show to the user.
 */
export const PERMISSION_CONTROLS: PermissionControlMetadata[] = [
  // Messaging
  {
    key: "msg.text.send",
    category: "Messaging",
    label: "Send messages",
    description: "Allow sending basic text messages.",
    defaultEffect: PermissionEffect.Allow,
  },
  {
    key: "msg.group.invite",
    category: "Messaging",
    label: "Invite to groups",
    description: "Allow adding you to group conversations.",
    defaultEffect: PermissionEffect.RequestApproval,
  },

  // Calls
  {
    key: "call.voice.initiate",
    category: "Calls",
    label: "Voice calls",
    description: "Allow ringing you for voice calls.",
    defaultEffect: PermissionEffect.Allow,
  },
  {
    key: "call.video.initiate",
    category: "Calls",
    label: "Video calls",
    description: "Allow ringing you for video calls.",
    defaultEffect: PermissionEffect.RequestApproval,
  },

  // Media & Downloads
  {
    key: "media.image.send",
    category: "Media & Downloads",
    label: "Send images",
    description: "Allow sending photos and image files.",
    defaultEffect: PermissionEffect.Allow,
  },
  {
    key: "media.document.send",
    category: "Media & Downloads",
    label: "Send documents",
    description: "Allow sending PDFs, spreadsheets, and other docs.",
    defaultEffect: PermissionEffect.AllowWithLimits,
  },

  // Protected Sharing
  {
    key: "share.location.view",
    category: "Protected Sharing",
    label: "View location",
    description: "Allow viewing your current physical location.",
    defaultEffect: PermissionEffect.Deny,
  },
  {
    key: "share.health.view",
    category: "Protected Sharing",
    label: "View health data",
    description: "Allow viewing your health metrics or medical summaries.",
    defaultEffect: PermissionEffect.Deny,
  },

  // AI Assistance
  {
    key: "ai.summary.generate",
    category: "AI Assistance",
    label: "AI summarization",
    description: "Allow AI agents to read and summarize chat history with this person.",
    defaultEffect: PermissionEffect.Allow,
  },
  {
    key: "ai.agent.delegate",
    category: "AI Assistance",
    label: "Agent delegation",
    description: "Allow delegating tasks to an AI agent on your behalf.",
    defaultEffect: PermissionEffect.RequestApproval,
  },

  // Business Actions
  {
    key: "biz.invoice.send",
    category: "Business Actions",
    label: "Send invoices",
    description: "Allow sending payment requests or invoices.",
    defaultEffect: PermissionEffect.Deny,
  },
  {
    key: "biz.contract.propose",
    category: "Business Actions",
    label: "Propose contracts",
    description: "Allow sending legal agreements for signature.",
    defaultEffect: PermissionEffect.Deny,
  },
];

/**
 * Returns a grouped dictionary of permission controls by category for UI rendering.
 */
export const getGroupedPermissionControls = (): Record<PermissionCategory, PermissionControlMetadata[]> => {
  const grouped = {} as Record<PermissionCategory, PermissionControlMetadata[]>;

  for (const control of PERMISSION_CONTROLS) {
    if (!grouped[control.category]) {
      grouped[control.category] = [];
    }
    grouped[control.category].push(control);
  }

  return grouped;
};

/**
 * Finds metadata for a specific backend key.
 */
export const getControlMetadata = (key: string): PermissionControlMetadata | undefined => {
  return PERMISSION_CONTROLS.find((c) => c.key === key);
};
