import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import type {
  ActionDecision,
  ActionDecisionReasonCode,
  ActionPermissionDefinition,
} from "./action-permission";
import {
  ActionDecisionEffect,
  getActionPermissionDefinition,
} from "./action-permission";
import { PERMISSION_KEY_LABELS } from "./permission-debug";

export interface ActionDecisionExplanation {
  decision: ActionDecision;
  summary: string;
  explanationText: string;
  outcome: "ALLOWED" | "DENIED" | "REQUIRES_APPROVAL" | "LIMITED";
  reasonCode: ActionDecisionReasonCode;
  permissionKey: string | null;
  permissionLabel: string;
  humanReadableFactors: HumanReadableFactor[];
  trace: ActionDecisionExplanationTrace;
}

export interface HumanReadableFactor {
  factor: string;
  effect: string;
  weight: "critical" | "high" | "normal" | "low";
  detail: string;
}

export interface ActionDecisionExplanationTrace {
  decisionPoint: string;
  decidingFactor: string | null;
  appliedFactors: string[];
  finalEffect: string;
}

export function explainActionDecision(
  decision: ActionDecision,
  conversationContext?: {
    conversationStatus?: string | null;
    conversationType?: string | null;
    stale?: boolean;
  },
): ActionDecisionExplanation {
  const actionDefinition = getActionPermissionDefinition(decision.actionType);
  const permissionLabel = actionDefinition
    ? (PERMISSION_KEY_LABELS[actionDefinition.permissionKey] ??
      actionDefinition.permissionKey)
    : String(decision.actionType);

  const humanReadableFactors = buildActionFactors(decision, actionDefinition);
  const decidingFactor = findDecidingFactor(decision, humanReadableFactors);

  const summary = buildActionSummary(
    decision,
    permissionLabel,
    conversationContext,
  );
  let outcome: ActionDecisionExplanation["outcome"];

  switch (decision.effect) {
    case ActionDecisionEffect.Allow:
      outcome = "ALLOWED";
      break;
    case ActionDecisionEffect.Deny:
      outcome = "DENIED";
      break;
    case ActionDecisionEffect.RequestApproval:
      outcome = "REQUIRES_APPROVAL";
      break;
    case ActionDecisionEffect.AllowWithLimits:
      outcome = "LIMITED";
      break;
    default:
      outcome = "DENIED";
  }

  const trace = buildActionTrace(
    decision,
    decidingFactor,
    humanReadableFactors,
  );

  return {
    decision,
    summary,
    explanationText: summary,
    outcome,
    reasonCode: decision.reasonCode,
    permissionKey: decision.permissionKey,
    permissionLabel,
    humanReadableFactors,
    trace,
  };
}

function buildActionFactors(
  decision: ActionDecision,
  actionDefinition: ActionPermissionDefinition | null,
): HumanReadableFactor[] {
  const factors: HumanReadableFactor[] = [];

  if (decision.reasonCode === "ACTION_INVALID_ACTOR") {
    factors.push({
      factor: "Actor validation",
      effect: "Denied",
      weight: "critical",
      detail: "The actor is not a participant in this conversation.",
    });
  }

  if (decision.reasonCode === "ACTION_DENIED_CONVERSATION_STATE") {
    const status = decision.trace?.conversationStatus ?? "unknown";
    factors.push({
      factor: "Conversation state",
      effect: "Denied",
      weight: "critical",
      detail: `Conversation is ${status.toLowerCase()}. Actions are blocked.`,
    });
  }

  if (actionDefinition) {
    const baseEffect = decision.trace?.baseEffect ?? null;
    if (baseEffect !== null) {
      factors.push({
        factor: "Base permission",
        effect: formatEffect(baseEffect),
        weight: "high",
        detail: `${PERMISSION_KEY_LABELS[actionDefinition.permissionKey] ?? actionDefinition.permissionKey} resolves to ${formatEffect(baseEffect)}.`,
      });
    }

    const contentEffect = decision.trace?.contentEffect ?? null;
    const contentAction = decision.trace?.contentAction ?? null;
    if (contentEffect !== null && contentAction !== null) {
      factors.push({
        factor: `Content rule (${contentAction})`,
        effect: formatEffect(contentEffect),
        weight: "normal",
        detail:
          contentEffect === PermissionEffect.Deny
            ? "Content-specific rule denies this action."
            : contentEffect === PermissionEffect.AllowWithLimits
              ? "Content rule allows with limits."
              : "Content rule allows this action.",
      });
    }

    if (decision.trace?.identityBehaviorApplied) {
      factors.push({
        factor: "Identity behavior",
        effect: "Adjusted",
        weight: "normal",
        detail: `Identity pair behavior restricts this action. Reasons: ${(decision.trace.identityBehaviorReasonCodes ?? []).join(", ") || "pair-specific rule"}.`,
      });
    }
  }

  if (decision.reasonCode === "ACTION_DENIED_RISK") {
    factors.push({
      factor: "Risk policy",
      effect: "Denied",
      weight: "critical",
      detail: "Risk evaluation blocked this action.",
    });
  }

  if (decision.reasonCode === "ACTION_REQUEST_APPROVAL") {
    factors.push({
      factor: "Permission resolution",
      effect: "Request approval",
      weight: "high",
      detail: "Permission requires approval before this action can proceed.",
    });
  }

  if (decision.reasonCode === "ACTION_ALLOWED_WITH_LIMITS") {
    factors.push({
      factor: "Permission limits",
      effect: "Allowed with limits",
      weight: "normal",
      detail: "Action is allowed but with applied limits.",
    });
  }

  return factors;
}

function findDecidingFactor(
  decision: ActionDecision,
  factors: HumanReadableFactor[],
): string | null {
  const critical = factors.find((f) => f.weight === "critical");
  if (critical) {
    return critical.factor;
  }
  const high = factors.find((f) => f.weight === "high");
  return high?.factor ?? null;
}

function buildActionSummary(
  decision: ActionDecision,
  permissionLabel: string,
  conversationContext?: {
    conversationStatus?: string | null;
    conversationType?: string | null;
    stale?: boolean;
  },
): string {
  const detailParts = [
    `reason=${decision.reasonCode}`,
    ...(decision.permissionKey ? [`permission=${decision.permissionKey}`] : []),
    ...(decision.reasons.length > 0
      ? [`details=${decision.reasons.join(" | ")}`]
      : []),
    ...(conversationContext?.conversationType
      ? [`conversationType=${conversationContext.conversationType}`]
      : []),
    ...(conversationContext?.conversationStatus
      ? [`conversationStatus=${conversationContext.conversationStatus}`]
      : []),
    ...(conversationContext?.stale === true ? ["binding=stale"] : []),
  ].join("; ");

  if (decision.allowed) {
    if (decision.effect === ActionDecisionEffect.AllowWithLimits) {
      return `Action '${permissionLabel}' is allowed with limits (${detailParts}).`;
    }
    return `Action '${permissionLabel}' is allowed (${detailParts}).`;
  }

  switch (decision.reasonCode) {
    case "ACTION_INVALID_ACTOR":
      return `Action '${permissionLabel}' is denied: actor is not a participant (${detailParts}).`;
    case "ACTION_DENIED_CONVERSATION_STATE":
      return `Action '${permissionLabel}' is denied by conversation state (${detailParts}).`;
    case "ACTION_DENIED_PERMISSION":
      return `Action '${permissionLabel}' is denied by permission resolution (${detailParts}).`;
    case "ACTION_DENIED_CONTENT_RULE":
      return `Action '${permissionLabel}' is denied by content rule (${detailParts}).`;
    case "ACTION_DENIED_RISK":
      return `Action '${permissionLabel}' is denied by risk policy (${detailParts}).`;
    case "ACTION_REQUEST_APPROVAL":
      return `Action '${permissionLabel}' requires approval (${detailParts}).`;
    default:
      return `Action '${permissionLabel}' is denied (${detailParts}).`;
  }
}

function buildActionTrace(
  decision: ActionDecision,
  decidingFactor: string | null,
  factors: HumanReadableFactor[],
): ActionDecisionExplanationTrace {
  return {
    decisionPoint: decidingFactor ?? "Permission evaluation",
    decidingFactor,
    appliedFactors: factors.map((f) => f.factor),
    finalEffect: decision.effect,
  };
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
