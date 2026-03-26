import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ConnectionPolicyTemplatePermissions,
  PermissionMergeReasonCode,
  PermissionMergeTraceEntry,
  ResolvedConnectionPermissions,
  ResolvedPermissionMap,
  ResolvedPermissionValue,
} from "./identity.types";
import type { PermissionKey } from "./permission-keys";

export enum PermissionDebugVerbosity {
  Basic = "BASIC",
  Detailed = "DETAILED",
}

const PERMISSION_KEYS_RAW = {
  messaging: {
    textSend: "msg.text.send",
    voiceSend: "msg.voice.send",
    imageSend: "msg.image.send",
    videoSend: "msg.video.send",
    documentSend: "msg.document.send",
    linkSend: "msg.link.send",
    contactSend: "msg.contact.send",
    locationSend: "msg.location.send",
  },
  calling: {
    voiceStart: "call.voice.start",
    videoStart: "call.video.start",
    directRing: "call.direct.ring",
    schedule: "call.schedule",
  },
  mediaPrivacy: {
    protectedSend: "media.protected.send",
    download: "media.download",
    forward: "media.forward",
    export: "media.export",
    screenshot: "media.screenshot",
    screenRecord: "media.screen_record",
  },
  vault: {
    itemAttach: "vault.item.attach",
    itemView: "vault.item.view",
    itemDownload: "vault.item.download",
    itemRevoke: "vault.item.revoke",
    itemReshare: "vault.item.reshare",
    folderCreate: "vault.folder.create",
  },
  profile: {
    basicView: "profile.basic.view",
    fullView: "profile.full.view",
    phoneView: "profile.phone.view",
    emailView: "profile.email.view",
    statusView: "profile.status.view",
    lastSeenView: "profile.last_seen.view",
    availabilityView: "profile.availability.view",
  },
  actions: {
    bookingRequestCreate: "booking.request.create",
    paymentRequestCreate: "payment.request.create",
    paymentExecute: "payment.execute",
    invoiceIssue: "invoice.issue",
    supportTicketCreate: "support.ticket.create",
    approvalRequestCreate: "approval.request.create",
  },
  ai: {
    summaryUse: "ai.summary.use",
    replyUse: "ai.reply.use",
    extractActionsUse: "ai.extract_actions.use",
  },
  relationship: {
    promoteTrusted: "relationship.promote_trusted",
    demoteLimited: "relationship.demote_limited",
    block: "relationship.block",
    report: "relationship.report",
    mute: "relationship.mute",
  },
} as const;

export const PERMISSION_KEY_LABELS: Record<string, string> = {
  [PERMISSION_KEYS_RAW.messaging.textSend]: "Send text messages",
  [PERMISSION_KEYS_RAW.messaging.voiceSend]: "Send voice messages",
  [PERMISSION_KEYS_RAW.messaging.imageSend]: "Send images",
  [PERMISSION_KEYS_RAW.messaging.videoSend]: "Send videos",
  [PERMISSION_KEYS_RAW.messaging.documentSend]: "Send documents",
  [PERMISSION_KEYS_RAW.messaging.linkSend]: "Send links",
  [PERMISSION_KEYS_RAW.messaging.contactSend]: "Send contacts",
  [PERMISSION_KEYS_RAW.messaging.locationSend]: "Send location",
  [PERMISSION_KEYS_RAW.calling.voiceStart]: "Start voice calls",
  [PERMISSION_KEYS_RAW.calling.videoStart]: "Start video calls",
  [PERMISSION_KEYS_RAW.calling.directRing]: "Direct ring",
  [PERMISSION_KEYS_RAW.calling.schedule]: "Schedule calls",
  [PERMISSION_KEYS_RAW.mediaPrivacy.protectedSend]: "Send protected media",
  [PERMISSION_KEYS_RAW.mediaPrivacy.download]: "Download media",
  [PERMISSION_KEYS_RAW.mediaPrivacy.forward]: "Forward media",
  [PERMISSION_KEYS_RAW.mediaPrivacy.export]: "Export media",
  [PERMISSION_KEYS_RAW.mediaPrivacy.screenshot]: "Take screenshots",
  [PERMISSION_KEYS_RAW.mediaPrivacy.screenRecord]: "Screen record",
  [PERMISSION_KEYS_RAW.vault.itemAttach]: "Attach vault items",
  [PERMISSION_KEYS_RAW.vault.itemView]: "View vault items",
  [PERMISSION_KEYS_RAW.vault.itemDownload]: "Download vault items",
  [PERMISSION_KEYS_RAW.vault.itemRevoke]: "Revoke vault items",
  [PERMISSION_KEYS_RAW.vault.itemReshare]: "Reshare vault items",
  [PERMISSION_KEYS_RAW.vault.folderCreate]: "Create vault folders",
  [PERMISSION_KEYS_RAW.profile.basicView]: "View basic profile",
  [PERMISSION_KEYS_RAW.profile.fullView]: "View full profile",
  [PERMISSION_KEYS_RAW.profile.phoneView]: "View phone number",
  [PERMISSION_KEYS_RAW.profile.emailView]: "View email address",
  [PERMISSION_KEYS_RAW.profile.statusView]: "View status",
  [PERMISSION_KEYS_RAW.profile.lastSeenView]: "View last seen",
  [PERMISSION_KEYS_RAW.profile.availabilityView]: "View availability",
  [PERMISSION_KEYS_RAW.actions.bookingRequestCreate]: "Create booking requests",
  [PERMISSION_KEYS_RAW.actions.paymentRequestCreate]: "Create payment requests",
  [PERMISSION_KEYS_RAW.actions.paymentExecute]: "Execute payments",
  [PERMISSION_KEYS_RAW.actions.invoiceIssue]: "Issue invoices",
  [PERMISSION_KEYS_RAW.actions.supportTicketCreate]: "Create support tickets",
  [PERMISSION_KEYS_RAW.actions.approvalRequestCreate]:
    "Create approval requests",
  [PERMISSION_KEYS_RAW.ai.summaryUse]: "Use AI summaries",
  [PERMISSION_KEYS_RAW.ai.replyUse]: "Use AI replies",
  [PERMISSION_KEYS_RAW.ai.extractActionsUse]: "Extract actions with AI",
  [PERMISSION_KEYS_RAW.relationship.promoteTrusted]: "Promote to trusted",
  [PERMISSION_KEYS_RAW.relationship.demoteLimited]: "Demote to limited",
  [PERMISSION_KEYS_RAW.relationship.block]: "Block connection",
  [PERMISSION_KEYS_RAW.relationship.report]: "Report connection",
  [PERMISSION_KEYS_RAW.relationship.mute]: "Mute connection",
};

export interface PermissionExplainRequest {
  connectionId: string;
  permissionKey: PermissionKey;
  applyRiskOverlay?: boolean;
  forceRefresh?: boolean;
  previewRiskSignals?: Array<{ signal: string; severity: string }>;
  verbosity?: PermissionDebugVerbosity;
}

export interface PermissionStageExplanation {
  stage:
    | "template"
    | "identity_behavior"
    | "relationship"
    | "trust"
    | "manual_override"
    | "risk"
    | "final";
  label: string;
  applied: boolean;
  changed: boolean;
  effectBefore: PermissionEffect | null;
  stageEffect: PermissionEffect | null;
  effectAfter: PermissionEffect;
  reasonCode: PermissionMergeReasonCode | null;
  explanation: string;
}

export interface PermissionExplainResult {
  connectionId?: string;
  permissionKey: PermissionKey;
  label: string;
  verbosity: PermissionDebugVerbosity;
  initialTemplateEffect: PermissionEffect | null;
  identityBehaviorEffect: PermissionEffect | null;
  relationshipEffect: PermissionEffect | null;
  trustEffect: PermissionEffect | null;
  manualOverrideEffect: PermissionEffect | null;
  riskEffect: PermissionEffect | null;
  finalEffect: PermissionEffect;
  finalReasonCode: PermissionMergeReasonCode | null;
  limits: ResolvedPermissionValue["limits"];
  notableFlags: string[];
  stages: PermissionStageExplanation[];
  explanationText: string;
  incomplete: boolean;
}

export interface PermissionDebugSummary {
  connection: {
    id: string;
    sourceIdentityId: string;
    targetIdentityId: string;
    templateKey: string;
    policyVersion: number;
    trustState: string;
  };
  verbosity: PermissionDebugVerbosity;
  summaryText: string;
  effectCounts: Record<PermissionEffect, number>;
  permissionCount: number;
  overriddenCount: number;
  riskAdjustedCount: number;
  stageSummaries: Array<{
    stage: PermissionStageExplanation["stage"];
    appliedCount: number;
    changedCount: number;
  }>;
  riskyPermissionKeys: PermissionKey[];
  blockedPermissionKeys: PermissionKey[];
  protectedPermissionKeys: PermissionKey[];
  contentSensitivePermissionKeys: PermissionKey[];
  cacheInfo?: {
    preferCache: boolean;
    preferSnapshot: boolean;
    forceRefresh: boolean;
    cacheHit: boolean;
    snapshotAvailable: boolean;
    snapshotFresh: boolean;
    snapshotFreshnessReason: string | null;
    previewSignalsProvided: boolean;
    resolvedVia: "CACHE" | "RECOMPUTED";
  };
  permissions?: PermissionExplainResult[];
}

export interface PermissionDiffEntry {
  permissionKey: PermissionKey;
  label: string;
  status:
    | "ADDED"
    | "REMOVED"
    | "PROMOTED"
    | "RESTRICTED"
    | "MODIFIED"
    | "UNCHANGED";
  beforeEffect: PermissionEffect | null;
  afterEffect: PermissionEffect | null;
  beforeLimits: Record<string, unknown> | null;
  afterLimits: Record<string, unknown> | null;
  beforeReasonCode: PermissionMergeReasonCode | null;
  afterReasonCode: PermissionMergeReasonCode | null;
  changed: boolean;
  explanation: string;
}

export interface PermissionDiffResult {
  changedKeys: PermissionKey[];
  addedKeys: PermissionKey[];
  removedKeys: PermissionKey[];
  entries: PermissionDiffEntry[];
  summary: {
    promoted: number;
    restricted: number;
    unchanged: number;
    added: number;
    removed: number;
    changed: number;
  };
  explanationText: string;
}

const PERMISSION_STAGE_ORDER = [
  "template",
  "identity_behavior",
  "relationship",
  "trust",
  "manual_override",
  "risk",
  "final",
] as const satisfies readonly PermissionStageExplanation["stage"][];

export function explainResolvedPermission(
  permissionKey: PermissionKey,
  resolved: ResolvedPermissionValue | undefined,
  options?: {
    connectionId?: string;
    verbosity?: PermissionDebugVerbosity;
  },
): PermissionExplainResult {
  const verbosity = options?.verbosity ?? PermissionDebugVerbosity.Basic;

  if (!resolved) {
    return {
      connectionId: options?.connectionId,
      permissionKey,
      label: getPermissionLabel(permissionKey),
      verbosity,
      initialTemplateEffect: null,
      identityBehaviorEffect: null,
      relationshipEffect: null,
      trustEffect: null,
      manualOverrideEffect: null,
      riskEffect: null,
      finalEffect: PermissionEffect.Deny,
      finalReasonCode: null,
      limits: undefined,
      notableFlags: ["TRACE_INCOMPLETE"],
      stages: [
        {
          stage: "final",
          label: "Final result",
          applied: true,
          changed: false,
          effectBefore: null,
          stageEffect: null,
          effectAfter: PermissionEffect.Deny,
          reasonCode: null,
          explanation:
            "No resolved permission entry exists, so the explanation is incomplete.",
        },
      ],
      explanationText: `${getPermissionLabel(permissionKey)} resolves to Deny, but the resolver trace is incomplete.`,
      incomplete: true,
    };
  }

  const trace = resolved.trace;
  const stages = buildPermissionStages(trace);
  const notableFlags = buildNotableFlags(trace);

  return {
    connectionId: options?.connectionId,
    permissionKey,
    label: getPermissionLabel(permissionKey),
    verbosity,
    initialTemplateEffect: trace.baseEffect,
    identityBehaviorEffect: trace.identityBehaviorEffect,
    relationshipEffect: trace.relationshipBehaviorEffect,
    trustEffect: trace.adjustmentEffect,
    manualOverrideEffect: trace.manualOverrideEffect,
    riskEffect: trace.riskAdjustmentEffect,
    finalEffect: resolved.finalEffect,
    finalReasonCode: trace.reasonCode,
    limits: resolved.limits,
    notableFlags,
    stages,
    explanationText: buildPermissionExplanationText(
      permissionKey,
      resolved,
      trace,
    ),
    incomplete: false,
  };
}

export function explainResolvedPermissions(
  resolved: ResolvedConnectionPermissions,
  options?: {
    verbosity?: PermissionDebugVerbosity;
    cacheInfo?: PermissionDebugSummary["cacheInfo"];
  },
): PermissionDebugSummary {
  const verbosity = options?.verbosity ?? PermissionDebugVerbosity.Basic;
  const entries = Object.entries(resolved.permissions).sort(([left], [right]) =>
    left.localeCompare(right),
  ) as Array<[PermissionKey, ResolvedPermissionValue]>;
  const explainedPermissions = entries.map(([permissionKey, permissionValue]) =>
    explainResolvedPermission(permissionKey, permissionValue, {
      connectionId: resolved.connectionId,
      verbosity,
    }),
  );

  const effectCounts: Record<PermissionEffect, number> = {
    [PermissionEffect.Allow]: 0,
    [PermissionEffect.Deny]: 0,
    [PermissionEffect.RequestApproval]: 0,
    [PermissionEffect.AllowWithLimits]: 0,
  };
  const stageStats = new Map<
    PermissionStageExplanation["stage"],
    { appliedCount: number; changedCount: number }
  >();
  const riskyPermissionKeys: PermissionKey[] = [];
  const blockedPermissionKeys: PermissionKey[] = [];
  const protectedPermissionKeys: PermissionKey[] = [];
  const contentSensitivePermissionKeys: PermissionKey[] = [];

  for (const explanation of explainedPermissions) {
    effectCounts[explanation.finalEffect] += 1;

    if (explanation.finalEffect === PermissionEffect.Deny) {
      blockedPermissionKeys.push(explanation.permissionKey);
    }
    if (explanation.notableFlags.includes("RISK_APPLIED")) {
      riskyPermissionKeys.push(explanation.permissionKey);
    }
    if (isProtectedPermissionKey(explanation.permissionKey)) {
      protectedPermissionKeys.push(explanation.permissionKey);
    }
    if (isContentSensitivePermissionKey(explanation.permissionKey)) {
      contentSensitivePermissionKeys.push(explanation.permissionKey);
    }

    for (const stage of explanation.stages) {
      const current = stageStats.get(stage.stage) ?? {
        appliedCount: 0,
        changedCount: 0,
      };

      if (stage.applied) {
        current.appliedCount += 1;
      }
      if (stage.changed) {
        current.changedCount += 1;
      }

      stageStats.set(stage.stage, current);
    }
  }

  const stageSummaries: PermissionDebugSummary["stageSummaries"] =
    PERMISSION_STAGE_ORDER.map((stage) => {
      const stats = stageStats.get(stage) ?? {
        appliedCount: 0,
        changedCount: 0,
      };
      return {
        stage,
        appliedCount: stats.appliedCount,
        changedCount: stats.changedCount,
      };
    });

  return {
    connection: {
      id: resolved.connectionId,
      sourceIdentityId: resolved.sourceIdentityId,
      targetIdentityId: resolved.targetIdentityId,
      templateKey: resolved.template.templateKey,
      policyVersion: resolved.template.policyVersion,
      trustState: resolved.trustState,
    },
    verbosity,
    summaryText: buildResolutionSummaryText(resolved, effectCounts),
    effectCounts,
    permissionCount: explainedPermissions.length,
    overriddenCount: resolved.overridesSummary.count,
    riskAdjustedCount: riskyPermissionKeys.length,
    stageSummaries,
    riskyPermissionKeys,
    blockedPermissionKeys,
    protectedPermissionKeys,
    contentSensitivePermissionKeys,
    cacheInfo: options?.cacheInfo,
    ...(verbosity === PermissionDebugVerbosity.Detailed
      ? { permissions: explainedPermissions }
      : {}),
  };
}

export function diffResolvedPermissions(
  before:
    | ResolvedConnectionPermissions
    | ResolvedPermissionMap
    | ConnectionPolicyTemplatePermissions,
  after:
    | ResolvedConnectionPermissions
    | ResolvedPermissionMap
    | ConnectionPolicyTemplatePermissions,
): PermissionDiffResult {
  const beforeComparable = toComparablePermissionMap(before);
  const afterComparable = toComparablePermissionMap(after);
  const keys = [
    ...new Set([
      ...Object.keys(beforeComparable),
      ...Object.keys(afterComparable),
    ]),
  ].sort() as PermissionKey[];
  const entries: PermissionDiffEntry[] = [];
  const changedKeys: PermissionKey[] = [];
  const addedKeys: PermissionKey[] = [];
  const removedKeys: PermissionKey[] = [];
  let promoted = 0;
  let restricted = 0;
  let unchanged = 0;

  for (const key of keys) {
    const beforeEntry = beforeComparable[key];
    const afterEntry = afterComparable[key];
    const entry = buildPermissionDiffEntry(key, beforeEntry, afterEntry);

    entries.push(entry);

    if (entry.status === "ADDED") {
      addedKeys.push(key);
      changedKeys.push(key);
      continue;
    }
    if (entry.status === "REMOVED") {
      removedKeys.push(key);
      changedKeys.push(key);
      continue;
    }
    if (entry.changed) {
      changedKeys.push(key);
    }
    if (entry.status === "PROMOTED") {
      promoted += 1;
    } else if (entry.status === "RESTRICTED") {
      restricted += 1;
    } else if (entry.status === "UNCHANGED") {
      unchanged += 1;
    }
  }

  return {
    changedKeys,
    addedKeys,
    removedKeys,
    entries,
    summary: {
      promoted,
      restricted,
      unchanged,
      added: addedKeys.length,
      removed: removedKeys.length,
      changed: changedKeys.length,
    },
    explanationText: explainPermissionDiffSummary(
      promoted,
      restricted,
      addedKeys.length,
      removedKeys.length,
      changedKeys.length,
    ),
  };
}

export function explainPermissionDiff(
  before:
    | ResolvedConnectionPermissions
    | ResolvedPermissionMap
    | ConnectionPolicyTemplatePermissions,
  after:
    | ResolvedConnectionPermissions
    | ResolvedPermissionMap
    | ConnectionPolicyTemplatePermissions,
): PermissionDiffResult {
  return diffResolvedPermissions(before, after);
}

export function formatPermissionTrace(
  trace: PermissionMergeTraceEntry,
): string[] {
  return buildPermissionStages(trace).map((stage) => {
    const before = stage.effectBefore ?? "n/a";
    const stageEffect = stage.stageEffect ?? "n/a";
    return `${stage.stage.toUpperCase()}: ${before} -> ${stage.effectAfter} (stage=${stageEffect}, reason=${stage.reasonCode ?? "UNKNOWN"})`;
  });
}

export function debugPermissionMap(
  permissions: ResolvedPermissionMap,
  includeTrace = false,
): Record<string, unknown> {
  return Object.keys(permissions)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, permissionKey) => {
      const resolved = permissions[permissionKey as PermissionKey];

      if (!resolved) {
        return accumulator;
      }

      accumulator[permissionKey] = includeTrace
        ? {
            effect: resolved.finalEffect,
            limits: resolved.limits ?? null,
            reasonCode: resolved.trace.reasonCode,
            trace: formatPermissionTrace(resolved.trace),
          }
        : resolved.finalEffect;

      return accumulator;
    }, {});
}

interface ComparablePermissionValue {
  effect: PermissionEffect;
  limits: Record<string, unknown> | null;
  reasonCode: PermissionMergeReasonCode | null;
}

function buildPermissionStages(
  trace: PermissionMergeTraceEntry,
): PermissionStageExplanation[] {
  return [
    {
      stage: "template",
      label: "Template base",
      applied: true,
      changed: false,
      effectBefore: null,
      stageEffect: trace.baseEffect,
      effectAfter: trace.baseEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "template"),
      explanation: `Template starts this permission at ${formatEffect(trace.baseEffect)}.`,
    },
    {
      stage: "identity_behavior",
      label: "Identity behavior",
      applied: trace.identityBehaviorEffect !== null,
      changed: trace.postIdentityBehaviorEffect !== trace.baseEffect,
      effectBefore: trace.baseEffect,
      stageEffect: trace.identityBehaviorEffect,
      effectAfter: trace.postIdentityBehaviorEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "identity_behavior"),
      explanation:
        trace.identityBehaviorEffect === null
          ? "Identity behavior did not contribute trace data for this permission."
          : trace.postIdentityBehaviorEffect === trace.baseEffect
            ? "Identity behavior was evaluated but did not change the effect."
            : `Identity behavior changed the effect to ${formatEffect(trace.postIdentityBehaviorEffect)}.`,
    },
    {
      stage: "relationship",
      label: "Relationship behavior",
      applied: trace.relationshipBehaviorEffect !== null,
      changed:
        trace.postRelationshipEffect !== trace.postIdentityBehaviorEffect,
      effectBefore: trace.postIdentityBehaviorEffect,
      stageEffect: trace.relationshipBehaviorEffect,
      effectAfter: trace.postRelationshipEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "relationship"),
      explanation:
        trace.relationshipBehaviorEffect === null
          ? "Relationship behavior did not contribute trace data for this permission."
          : trace.postRelationshipEffect === trace.postIdentityBehaviorEffect
            ? "Relationship behavior was evaluated but did not change the effect."
            : `Relationship behavior changed the effect to ${formatEffect(trace.postRelationshipEffect)}.`,
    },
    {
      stage: "trust",
      label: "Trust state",
      applied: trace.adjustmentEffect !== null,
      changed: trace.postTrustEffect !== trace.postRelationshipEffect,
      effectBefore: trace.postRelationshipEffect,
      stageEffect: trace.adjustmentEffect,
      effectAfter: trace.postTrustEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "trust"),
      explanation:
        trace.adjustmentEffect === null
          ? "Trust state did not contribute trace data for this permission."
          : trace.postTrustEffect === trace.postRelationshipEffect
            ? "Trust state was evaluated but did not change the effect."
            : `Trust state changed the effect to ${formatEffect(trace.postTrustEffect)}.`,
    },
    {
      stage: "manual_override",
      label: "Manual override",
      applied: trace.manualOverrideEffect !== null || trace.overrideApplied,
      changed: trace.preRiskEffect !== trace.postTrustEffect,
      effectBefore: trace.postTrustEffect,
      stageEffect: trace.manualOverrideEffect,
      effectAfter: trace.preRiskEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "manual_override"),
      explanation:
        trace.manualOverrideEffect === null && !trace.overrideApplied
          ? "No manual override was applied."
          : trace.preRiskEffect === trace.postTrustEffect
            ? "A manual override path was evaluated, but the final pre-risk effect stayed the same."
            : `Manual override changed the effect to ${formatEffect(trace.preRiskEffect)}.`,
    },
    {
      stage: "risk",
      label: "Risk overlay",
      applied: trace.riskAdjustmentEffect !== null || trace.riskApplied,
      changed: trace.finalEffect !== trace.preRiskEffect,
      effectBefore: trace.preRiskEffect,
      stageEffect: trace.riskAdjustmentEffect,
      effectAfter: trace.finalEffect,
      reasonCode: deriveStageReasonCode(trace.reasonCode, "risk"),
      explanation:
        trace.riskAdjustmentEffect === null && !trace.riskApplied
          ? "Risk overlay did not change this permission."
          : trace.finalEffect === trace.preRiskEffect
            ? "Risk overlay evaluated this permission without changing the effect."
            : `Risk overlay changed the effect to ${formatEffect(trace.finalEffect)}${trace.riskReasons.length > 0 ? ` because of ${trace.riskReasons.join(", ")}` : ""}.`,
    },
    {
      stage: "final",
      label: "Final result",
      applied: true,
      changed: trace.finalEffect !== trace.baseEffect,
      effectBefore: trace.preRiskEffect,
      stageEffect: trace.finalEffect,
      effectAfter: trace.finalEffect,
      reasonCode: trace.reasonCode,
      explanation: `Final effect is ${formatEffect(trace.finalEffect)} with reason code ${trace.reasonCode}.`,
    },
  ];
}

function buildNotableFlags(trace: PermissionMergeTraceEntry): string[] {
  const flags: string[] = [];

  if (trace.overrideApplied) {
    flags.push("OVERRIDE_APPLIED");
  }
  if (trace.guardrailApplied) {
    flags.push("GUARDRAIL_APPLIED");
  }
  if (trace.riskApplied) {
    flags.push("RISK_APPLIED");
  }
  if (trace.riskReasons.length > 0) {
    flags.push(...trace.riskReasons.map((reason) => `RISK:${reason}`));
  }

  return flags;
}

function buildPermissionExplanationText(
  permissionKey: PermissionKey,
  resolved: ResolvedPermissionValue,
  trace: PermissionMergeTraceEntry,
): string {
  const clauses = [
    `${getPermissionLabel(permissionKey)} resolves to ${formatEffect(resolved.finalEffect)}`,
    `template=${formatEffect(trace.baseEffect)}`,
  ];

  if (trace.postIdentityBehaviorEffect !== trace.baseEffect) {
    clauses.push(`identity=${formatEffect(trace.postIdentityBehaviorEffect)}`);
  }
  if (trace.postRelationshipEffect !== trace.postIdentityBehaviorEffect) {
    clauses.push(`relationship=${formatEffect(trace.postRelationshipEffect)}`);
  }
  if (trace.postTrustEffect !== trace.postRelationshipEffect) {
    clauses.push(`trust=${formatEffect(trace.postTrustEffect)}`);
  }
  if (trace.preRiskEffect !== trace.postTrustEffect) {
    clauses.push(`override=${formatEffect(trace.preRiskEffect)}`);
  }
  if (trace.finalEffect !== trace.preRiskEffect) {
    clauses.push(`risk=${formatEffect(trace.finalEffect)}`);
  }

  clauses.push(`reason=${trace.reasonCode}`);

  if (trace.riskReasons.length > 0) {
    clauses.push(`signals=${trace.riskReasons.join(",")}`);
  }

  return `${clauses.join("; ")}.`;
}

function buildResolutionSummaryText(
  resolved: ResolvedConnectionPermissions,
  effectCounts: Record<PermissionEffect, number>,
): string {
  return `Resolved ${
    Object.keys(resolved.permissions).length
  } permissions for connection ${resolved.connectionId}. Allow=${effectCounts[PermissionEffect.Allow]}, AllowWithLimits=${effectCounts[PermissionEffect.AllowWithLimits]}, RequestApproval=${effectCounts[PermissionEffect.RequestApproval]}, Deny=${effectCounts[PermissionEffect.Deny]}.`;
}

function buildPermissionDiffEntry(
  permissionKey: PermissionKey,
  beforeEntry: ComparablePermissionValue | undefined,
  afterEntry: ComparablePermissionValue | undefined,
): PermissionDiffEntry {
  if (!beforeEntry && afterEntry) {
    return {
      permissionKey,
      label: getPermissionLabel(permissionKey),
      status: "ADDED",
      beforeEffect: null,
      afterEffect: afterEntry.effect,
      beforeLimits: null,
      afterLimits: afterEntry.limits,
      beforeReasonCode: null,
      afterReasonCode: afterEntry.reasonCode,
      changed: true,
      explanation: `${getPermissionLabel(permissionKey)} was added with ${formatEffect(afterEntry.effect)}.`,
    };
  }

  if (beforeEntry && !afterEntry) {
    return {
      permissionKey,
      label: getPermissionLabel(permissionKey),
      status: "REMOVED",
      beforeEffect: beforeEntry.effect,
      afterEffect: null,
      beforeLimits: beforeEntry.limits,
      afterLimits: null,
      beforeReasonCode: beforeEntry.reasonCode,
      afterReasonCode: null,
      changed: true,
      explanation: `${getPermissionLabel(permissionKey)} was removed after previously resolving to ${formatEffect(beforeEntry.effect)}.`,
    };
  }

  if (!beforeEntry || !afterEntry) {
    return {
      permissionKey,
      label: getPermissionLabel(permissionKey),
      status: "UNCHANGED",
      beforeEffect: null,
      afterEffect: null,
      beforeLimits: null,
      afterLimits: null,
      beforeReasonCode: null,
      afterReasonCode: null,
      changed: false,
      explanation: `${getPermissionLabel(permissionKey)} has no comparable entries.`,
    };
  }

  const effectDelta =
    effectRank(afterEntry.effect) - effectRank(beforeEntry.effect);
  const limitsChanged =
    stableStringify(beforeEntry.limits) !== stableStringify(afterEntry.limits);
  const reasonChanged = beforeEntry.reasonCode !== afterEntry.reasonCode;
  const changed =
    beforeEntry.effect !== afterEntry.effect || limitsChanged || reasonChanged;
  let status: PermissionDiffEntry["status"] = "UNCHANGED";

  if (beforeEntry.effect !== afterEntry.effect) {
    status = effectDelta > 0 ? "PROMOTED" : "RESTRICTED";
  } else if (limitsChanged || reasonChanged) {
    status = "MODIFIED";
  }

  return {
    permissionKey,
    label: getPermissionLabel(permissionKey),
    status,
    beforeEffect: beforeEntry.effect,
    afterEffect: afterEntry.effect,
    beforeLimits: beforeEntry.limits,
    afterLimits: afterEntry.limits,
    beforeReasonCode: beforeEntry.reasonCode,
    afterReasonCode: afterEntry.reasonCode,
    changed,
    explanation: buildPermissionDiffExplanation(
      permissionKey,
      status,
      beforeEntry,
      afterEntry,
      limitsChanged,
      reasonChanged,
    ),
  };
}

function buildPermissionDiffExplanation(
  permissionKey: PermissionKey,
  status: PermissionDiffEntry["status"],
  beforeEntry: ComparablePermissionValue,
  afterEntry: ComparablePermissionValue,
  limitsChanged: boolean,
  reasonChanged: boolean,
): string {
  const label = getPermissionLabel(permissionKey);

  if (status === "PROMOTED" || status === "RESTRICTED") {
    return `${label} changed from ${formatEffect(beforeEntry.effect)} to ${formatEffect(afterEntry.effect)}.`;
  }
  if (status === "MODIFIED") {
    const parts: string[] = [];
    if (limitsChanged) {
      parts.push("limits changed");
    }
    if (reasonChanged) {
      parts.push(
        `reason ${beforeEntry.reasonCode ?? "UNKNOWN"} -> ${afterEntry.reasonCode ?? "UNKNOWN"}`,
      );
    }
    return `${label} kept ${formatEffect(afterEntry.effect)}, but ${parts.join(" and ")}.`;
  }

  return `${label} is unchanged at ${formatEffect(afterEntry.effect)}.`;
}

function explainPermissionDiffSummary(
  promoted: number,
  restricted: number,
  added: number,
  removed: number,
  changed: number,
): string {
  if (changed === 0) {
    return "No permission differences were detected.";
  }

  return `Permission diff detected ${changed} changed keys (${promoted} promoted, ${restricted} restricted, ${added} added, ${removed} removed).`;
}

function toComparablePermissionMap(
  input:
    | ResolvedConnectionPermissions
    | ResolvedPermissionMap
    | ConnectionPolicyTemplatePermissions,
): Partial<Record<PermissionKey, ComparablePermissionValue>> {
  if ("permissions" in input) {
    return toComparablePermissionMap(input.permissions);
  }

  return Object.keys(input)
    .sort()
    .reduce<Partial<Record<PermissionKey, ComparablePermissionValue>>>(
      (accumulator, permissionKey) => {
        const typedKey = permissionKey as PermissionKey;
        const value = input[typedKey as keyof typeof input];

        if (!value) {
          return accumulator;
        }

        if ("finalEffect" in value) {
          accumulator[typedKey] = {
            effect: value.finalEffect,
            limits:
              (value.limits as Record<string, unknown> | undefined) ?? null,
            reasonCode: value.trace.reasonCode,
          };
          return accumulator;
        }

        accumulator[typedKey] = {
          effect: value.effect,
          limits: (value.limits as Record<string, unknown> | undefined) ?? null,
          reasonCode: null,
        };
        return accumulator;
      },
      {},
    );
}

function deriveStageReasonCode(
  reasonCode: PermissionMergeReasonCode,
  stage: PermissionStageExplanation["stage"],
): PermissionMergeReasonCode | null {
  const prefixes: Record<PermissionStageExplanation["stage"], string[]> = {
    template: ["TEMPLATE_"],
    identity_behavior: ["IDENTITY_"],
    relationship: ["RELATIONSHIP_"],
    trust: ["TRUST_"],
    manual_override: ["OVERRIDE_"],
    risk: ["RISK_"],
    final: [
      "TEMPLATE_",
      "IDENTITY_",
      "RELATIONSHIP_",
      "TRUST_",
      "OVERRIDE_",
      "RISK_",
    ],
  };

  return prefixes[stage].some((prefix) => reasonCode.startsWith(prefix))
    ? reasonCode
    : null;
}

function effectRank(effect: PermissionEffect): number {
  switch (effect) {
    case PermissionEffect.Deny:
      return 0;
    case PermissionEffect.RequestApproval:
      return 1;
    case PermissionEffect.AllowWithLimits:
      return 2;
    case PermissionEffect.Allow:
      return 3;
  }
}

function formatEffect(effect: PermissionEffect): string {
  switch (effect) {
    case PermissionEffect.Allow:
      return "Allow";
    case PermissionEffect.Deny:
      return "Deny";
    case PermissionEffect.RequestApproval:
      return "Request approval";
    case PermissionEffect.AllowWithLimits:
      return "Allow with limits";
  }
}

function getPermissionLabel(permissionKey: PermissionKey): string {
  return PERMISSION_KEY_LABELS[permissionKey] ?? permissionKey;
}

function isProtectedPermissionKey(permissionKey: PermissionKey): boolean {
  return (
    permissionKey.startsWith("media.") ||
    permissionKey.startsWith("vault.") ||
    permissionKey.startsWith("call.")
  );
}

function isContentSensitivePermissionKey(
  permissionKey: PermissionKey,
): boolean {
  return (
    permissionKey.startsWith("vault.") ||
    permissionKey.startsWith("media.") ||
    permissionKey.startsWith("profile.")
  );
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
