import { Injectable } from "@nestjs/common";

import { PermissionEffect } from "../../common/enums/permission-effect.enum";

import {
  CallDecisionEffect,
  CallInitiationMode,
  CallType,
  type CallPermissionDecision,
  type CallPermissionDefinition,
  type CallRestrictionSummary,
  type ProtectedCallRestrictionFlags,
  getCallPermissionDefinition,
} from "./call-permission";
import { EnforceCallDto } from "./dto/enforce-call.dto";
import {
  ConversationStatus,
  ConversationType,
  type IdentityBehaviorRuleSummary,
} from "./identity.types";
import { getIdentityTypeBehavior } from "./identity-type-behaviors";
import { IdentitiesService } from "./identities.service";
import { PermissionAuditEventType } from "./permission-audit";

@Injectable()
export class CallEnforcementService {
  constructor(private readonly identitiesService: IdentitiesService) {}

  async enforceCall(input: EnforceCallDto): Promise<CallPermissionDecision> {
    const context = await this.identitiesService.resolveConversationContext({
      conversationId: input.conversationId,
    });
    if (input.currentUserId) {
      await this.identitiesService.assertConversationActionAccessibleToUser({
        userId: input.currentUserId,
        conversation: context.conversation,
        actorIdentityId: input.actorIdentityId,
      });
    }
    const staleCheck =
      await this.identitiesService.isConversationPermissionBindingStale(
        input.conversationId,
      );
    const rebound = staleCheck.stale
      ? await this.identitiesService.bindResolvedPermissionsToConversation({
          conversationId: input.conversationId,
        })
      : null;
    const resolvedPermissions =
      rebound?.resolvedConnectionPermissions ?? context.resolvedPermissions;
    const conversation = context.conversation;
    const sourceIdentityType =
      await this.identitiesService.getIdentityTypeForIdentity(
        conversation.sourceIdentityId,
      );
    const targetIdentityType =
      await this.identitiesService.getIdentityTypeForIdentity(
        conversation.targetIdentityId,
      );
    const identityBehaviorSummary = getIdentityTypeBehavior(
      sourceIdentityType,
      targetIdentityType,
    ).summary;

    if (
      !this.validateActorInConversation(input.actorIdentityId, conversation)
    ) {
      return this.finalizeDecision(
        this.buildDecision({
          allowed: false,
          effect: CallDecisionEffect.Deny,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: null,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType: conversation.conversationType,
          reasonCode: "CALL_DENIED_INVALID_ACTOR",
          reasons: ["Actor is not part of this conversation"],
          restrictionSummary: createRestrictionSummary(),
          trace: {
            staleBinding: staleCheck.stale,
            baseEffect: null,
            runtimeRestrictions: this.buildProtectedRuntimeFlags(
              input,
              resolvedPermissions.riskSummary.blockedProtectedMode,
              conversation.conversationType,
            ),
            blockedCallsByRisk: resolvedPermissions.riskSummary.blockedCalls,
          },
        }),
        resolvedPermissions.connectionId,
      );
    }

    const stateDecision = this.enforceConversationState(
      conversation.conversationStatus,
      input,
      staleCheck.stale,
      resolvedPermissions.riskSummary.blockedCalls,
    );

    if (stateDecision) {
      return this.finalizeDecision(
        stateDecision,
        resolvedPermissions.connectionId,
      );
    }

    const compatibilityDecision = this.enforceConversationCompatibility(
      conversation.conversationType,
      input,
      staleCheck.stale,
      resolvedPermissions.riskSummary.blockedCalls,
      identityBehaviorSummary,
    );

    if (compatibilityDecision) {
      return this.finalizeDecision(
        compatibilityDecision,
        resolvedPermissions.connectionId,
      );
    }

    const callDefinition = this.mapCallToPermissionKey(
      input.callType,
      input.initiationMode,
    );

    if (!callDefinition) {
      return this.finalizeDecision(
        this.buildDecision({
          allowed: false,
          effect: CallDecisionEffect.Deny,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: null,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType: conversation.conversationType,
          reasonCode: "CALL_DENIED_CALL_TYPE_UNSUPPORTED",
          reasons: ["Unsupported call type or initiation mode"],
          restrictionSummary: createRestrictionSummary(),
          trace: {
            staleBinding: staleCheck.stale,
            baseEffect: null,
            runtimeRestrictions: this.buildProtectedRuntimeFlags(
              input,
              resolvedPermissions.riskSummary.blockedProtectedMode,
              conversation.conversationType,
            ),
            blockedCallsByRisk: resolvedPermissions.riskSummary.blockedCalls,
          },
        }),
        resolvedPermissions.connectionId,
      );
    }

    const basePermission =
      resolvedPermissions.permissions[callDefinition.permissionKey];

    if (!basePermission) {
      return this.finalizeDecision(
        this.buildDecision({
          allowed: false,
          effect: CallDecisionEffect.Deny,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: callDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType: conversation.conversationType,
          reasonCode: "CALL_DENIED_PERMISSION",
          reasons: ["Missing call permission resolution"],
          restrictionSummary: createRestrictionSummary(),
          trace: {
            staleBinding: staleCheck.stale,
            baseEffect: null,
            runtimeRestrictions: this.buildProtectedRuntimeFlags(
              input,
              resolvedPermissions.riskSummary.blockedProtectedMode,
              conversation.conversationType,
            ),
            blockedCallsByRisk: resolvedPermissions.riskSummary.blockedCalls,
          },
        }),
        resolvedPermissions.connectionId,
      );
    }

    const schedulingRequired = this.isSchedulingRequired(
      basePermission.finalEffect,
      resolvedPermissions.riskSummary.blockedProtectedMode,
      conversation.conversationType,
      identityBehaviorSummary.restrictionFlags.schedulingBiasForCalls,
    );
    const runtimeRestrictions = this.buildProtectedRuntimeFlags(
      input,
      resolvedPermissions.riskSummary.blockedProtectedMode,
      conversation.conversationType,
    );

    const permissionDecision = this.evaluateBasePermission(
      input,
      callDefinition,
      basePermission.finalEffect,
      conversation.conversationType,
      staleCheck.stale,
      schedulingRequired,
      runtimeRestrictions,
      resolvedPermissions.riskSummary.blockedCalls,
    );

    if (
      permissionDecision.effect === CallDecisionEffect.Deny ||
      permissionDecision.effect === CallDecisionEffect.RequestApproval
    ) {
      return this.finalizeDecision(
        permissionDecision,
        resolvedPermissions.connectionId,
      );
    }

    const protectedDecision = this.enforceProtectedMode(
      input,
      conversation.conversationType,
      callDefinition,
      staleCheck.stale,
      basePermission.finalEffect,
      schedulingRequired,
      runtimeRestrictions,
      resolvedPermissions.riskSummary.blockedCalls,
    );

    if (protectedDecision) {
      return this.finalizeDecision(
        protectedDecision,
        resolvedPermissions.connectionId,
      );
    }

    const riskDecision = this.enforceRiskRestrictions(
      input,
      callDefinition,
      staleCheck.stale,
      basePermission.finalEffect,
      schedulingRequired,
      runtimeRestrictions,
      resolvedPermissions.riskSummary.blockedCalls,
    );

    if (riskDecision) {
      return this.finalizeDecision(
        riskDecision,
        resolvedPermissions.connectionId,
      );
    }

    const modeDecision = this.applyInitiationModeRules(
      input,
      callDefinition,
      basePermission.finalEffect,
      conversation.conversationType,
      staleCheck.stale,
      schedulingRequired,
      runtimeRestrictions,
      resolvedPermissions.riskSummary.blockedCalls,
    );

    if (modeDecision) {
      return this.finalizeDecision(
        modeDecision,
        resolvedPermissions.connectionId,
      );
    }

    return this.finalizeDecision(
      this.buildDecision({
        allowed: true,
        effect:
          basePermission.finalEffect === PermissionEffect.AllowWithLimits
            ? CallDecisionEffect.AllowWithLimits
            : CallDecisionEffect.Allow,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType: conversation.conversationType,
        reasonCode: "CALL_ALLOWED",
        reasons: ["Call initiation allowed"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          schedulingRequired,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding: staleCheck.stale,
          baseEffect: basePermission.finalEffect,
          runtimeRestrictions,
          blockedCallsByRisk: resolvedPermissions.riskSummary.blockedCalls,
          identityBehaviorApplied:
            identityBehaviorSummary.restrictionFlags.schedulingBiasForCalls,
          identityBehaviorReasonCodes: identityBehaviorSummary.reasonCodes,
          identityBehaviorSummary,
        },
      }),
      resolvedPermissions.connectionId,
    );
  }

  validateActorInConversation(
    actorIdentityId: string,
    conversation: {
      sourceIdentityId: string;
      targetIdentityId: string;
    },
  ): boolean {
    return (
      actorIdentityId === conversation.sourceIdentityId ||
      actorIdentityId === conversation.targetIdentityId
    );
  }

  mapCallToPermissionKey(
    callType: CallType,
    initiationMode: CallInitiationMode,
  ): CallPermissionDefinition | null {
    return getCallPermissionDefinition(callType, initiationMode);
  }

  buildDecision(
    input: Omit<CallPermissionDecision, "evaluatedAt">,
  ): CallPermissionDecision {
    return {
      ...input,
      evaluatedAt: new Date(),
    };
  }

  private finalizeDecision(
    decision: CallPermissionDecision,
    connectionId: string | null,
  ): CallPermissionDecision {
    const auditResult = this.identitiesService.safeRecordPermissionAuditEvent?.(
      {
        eventType: PermissionAuditEventType.CallEnforced,
        connectionId,
        conversationId: decision.conversationId,
        permissionKey: decision.permissionKey,
        actorIdentityId: decision.actorIdentityId,
        summaryText: `Call ${decision.callType}:${decision.initiationMode} evaluated as ${decision.effect}.`,
        payloadJson: {
          allowed: decision.allowed,
          effect: decision.effect,
          reasonCode: decision.reasonCode,
          reasons: decision.reasons,
          restrictionSummary: decision.restrictionSummary,
          trace: decision.trace,
        },
      },
    );

    void Promise.resolve(auditResult).catch(() => undefined);

    return decision;
  }

  private enforceConversationState(
    conversationStatus: ConversationStatus,
    input: EnforceCallDto,
    staleBinding: boolean,
    blockedCallsByRisk: boolean,
  ): CallPermissionDecision | null {
    if (
      conversationStatus === ConversationStatus.Blocked ||
      conversationStatus === ConversationStatus.Locked ||
      conversationStatus === ConversationStatus.Archived
    ) {
      return this.buildDecision({
        allowed: false,
        effect: CallDecisionEffect.Deny,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType: null,
        reasonCode: "CALL_DENIED_CONVERSATION_STATE",
        reasons: ["Conversation state blocks calls"],
        restrictionSummary: createRestrictionSummary(),
        trace: {
          staleBinding,
          baseEffect: null,
          runtimeRestrictions: this.buildProtectedRuntimeFlags(
            input,
            false,
            ConversationType.Direct,
          ),
          blockedCallsByRisk,
        },
      });
    }

    return null;
  }

  private evaluateBasePermission(
    input: EnforceCallDto,
    callDefinition: CallPermissionDefinition,
    effect: PermissionEffect,
    conversationType: ConversationType,
    staleBinding: boolean,
    schedulingRequired: boolean,
    runtimeRestrictions: ProtectedCallRestrictionFlags,
    blockedCallsByRisk: boolean,
  ): CallPermissionDecision {
    switch (effect) {
      case PermissionEffect.Deny:
        return this.buildDecision({
          allowed: false,
          effect: CallDecisionEffect.Deny,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: callDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType,
          reasonCode: "CALL_DENIED_PERMISSION",
          reasons: ["Call permission denied"],
          restrictionSummary: this.createDecisionRestrictionSummary(
            schedulingRequired,
            runtimeRestrictions,
            input.initiationMode,
          ),
          trace: {
            staleBinding,
            baseEffect: effect,
            runtimeRestrictions,
            blockedCallsByRisk,
          },
        });
      case PermissionEffect.RequestApproval:
        return this.buildDecision({
          allowed: false,
          effect: CallDecisionEffect.RequestApproval,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: callDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType,
          reasonCode: "CALL_REQUEST_REQUIRED",
          reasons: ["Call requires approval"],
          restrictionSummary: this.createDecisionRestrictionSummary(
            schedulingRequired,
            runtimeRestrictions,
            input.initiationMode,
          ),
          trace: {
            staleBinding,
            baseEffect: effect,
            runtimeRestrictions,
            blockedCallsByRisk,
          },
        });
      case PermissionEffect.AllowWithLimits:
        return this.buildDecision({
          allowed: true,
          effect: CallDecisionEffect.AllowWithLimits,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: callDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType,
          reasonCode: "CALL_ALLOWED",
          reasons: ["Call allowed with limits"],
          restrictionSummary: this.createDecisionRestrictionSummary(
            schedulingRequired,
            runtimeRestrictions,
            input.initiationMode,
          ),
          trace: {
            staleBinding,
            baseEffect: effect,
            runtimeRestrictions,
            blockedCallsByRisk,
          },
        });
      case PermissionEffect.Allow:
      default:
        return this.buildDecision({
          allowed: true,
          effect: CallDecisionEffect.Allow,
          callType: input.callType,
          initiationMode: input.initiationMode,
          permissionKey: callDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          conversationType,
          reasonCode: "CALL_ALLOWED",
          reasons: ["Call allowed"],
          restrictionSummary: this.createDecisionRestrictionSummary(
            schedulingRequired,
            runtimeRestrictions,
            input.initiationMode,
          ),
          trace: {
            staleBinding,
            baseEffect: effect,
            runtimeRestrictions,
            blockedCallsByRisk,
          },
        });
    }
  }

  private enforceConversationCompatibility(
    conversationType: ConversationType,
    input: EnforceCallDto,
    staleBinding: boolean,
    blockedCallsByRisk: boolean,
    pairBehaviorSummary: IdentityBehaviorRuleSummary,
  ): CallPermissionDecision | null {
    if (
      conversationType === ConversationType.BusinessDirect &&
      !pairBehaviorSummary.restrictionFlags.businessConversationAllowed
    ) {
      return this.buildDecision({
        allowed: false,
        effect: CallDecisionEffect.Deny,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType,
        reasonCode: "CALL_DENIED_IDENTITY_INCOMPATIBLE",
        reasons: ["Business call compatibility is not enabled in this prompt"],
        restrictionSummary: createRestrictionSummary(),
        trace: {
          staleBinding,
          baseEffect: null,
          runtimeRestrictions: this.buildProtectedRuntimeFlags(
            input,
            false,
            conversationType,
          ),
          blockedCallsByRisk,
          identityBehaviorApplied: true,
          identityBehaviorReasonCodes: pairBehaviorSummary.reasonCodes,
          identityBehaviorSummary: pairBehaviorSummary,
        },
      });
    }

    return null;
  }

  private applyInitiationModeRules(
    input: EnforceCallDto,
    callDefinition: CallPermissionDefinition,
    effect: PermissionEffect,
    conversationType: ConversationType,
    staleBinding: boolean,
    schedulingRequired: boolean,
    runtimeRestrictions: ProtectedCallRestrictionFlags,
    blockedCallsByRisk: boolean,
  ): CallPermissionDecision | null {
    if (
      input.initiationMode === CallInitiationMode.Direct &&
      schedulingRequired
    ) {
      return this.buildDecision({
        allowed: false,
        effect: CallDecisionEffect.Deny,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType,
        reasonCode: "CALL_DENIED_SCHEDULE_REQUIRED",
        reasons: ["Direct call is not allowed when scheduling is required"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          true,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding,
          baseEffect: effect,
          runtimeRestrictions,
          blockedCallsByRisk,
        },
      });
    }

    if (input.initiationMode === CallInitiationMode.Request) {
      return this.buildDecision({
        allowed: true,
        effect:
          effect === PermissionEffect.AllowWithLimits
            ? CallDecisionEffect.AllowWithLimits
            : CallDecisionEffect.RequestApproval,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType,
        reasonCode: "CALL_REQUEST_REQUIRED",
        reasons: ["Call request flow is allowed"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          schedulingRequired,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding,
          baseEffect: effect,
          runtimeRestrictions,
          blockedCallsByRisk,
        },
      });
    }

    if (input.initiationMode === CallInitiationMode.Scheduled) {
      return this.buildDecision({
        allowed: true,
        effect:
          effect === PermissionEffect.AllowWithLimits
            ? CallDecisionEffect.AllowWithLimits
            : CallDecisionEffect.Allow,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType,
        reasonCode: "CALL_ALLOWED",
        reasons: ["Scheduled call is allowed"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          schedulingRequired,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding,
          baseEffect: effect,
          runtimeRestrictions,
          blockedCallsByRisk,
        },
      });
    }

    return null;
  }

  private enforceProtectedMode(
    input: EnforceCallDto,
    conversationType: ConversationType,
    callDefinition: CallPermissionDefinition,
    staleBinding: boolean,
    effect: PermissionEffect,
    schedulingRequired: boolean,
    runtimeRestrictions: ProtectedCallRestrictionFlags,
    blockedCallsByRisk: boolean,
  ): CallPermissionDecision | null {
    if (conversationType !== ConversationType.ProtectedDirect) {
      return null;
    }

    if (
      runtimeRestrictions.screenCaptureDetected ||
      runtimeRestrictions.castingDetected ||
      runtimeRestrictions.deviceIntegrityCompromised ||
      runtimeRestrictions.protectedModeBlockedByRisk ||
      runtimeRestrictions.strictExpectationUnknownRuntime
    ) {
      return this.buildDecision({
        allowed: false,
        effect: CallDecisionEffect.Deny,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType,
        reasonCode: "CALL_DENIED_PROTECTED_MODE",
        reasons: ["Protected mode restrictions block this call"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          schedulingRequired,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding,
          baseEffect: effect,
          runtimeRestrictions,
          blockedCallsByRisk,
        },
      });
    }

    return null;
  }

  private enforceRiskRestrictions(
    input: EnforceCallDto,
    callDefinition: CallPermissionDefinition,
    staleBinding: boolean,
    effect: PermissionEffect,
    schedulingRequired: boolean,
    runtimeRestrictions: ProtectedCallRestrictionFlags,
    blockedCallsByRisk: boolean,
  ): CallPermissionDecision | null {
    if (blockedCallsByRisk) {
      return this.buildDecision({
        allowed: false,
        effect: CallDecisionEffect.Deny,
        callType: input.callType,
        initiationMode: input.initiationMode,
        permissionKey: callDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        conversationType: null,
        reasonCode: "CALL_DENIED_RISK",
        reasons: ["Risk policy blocks calls"],
        restrictionSummary: this.createDecisionRestrictionSummary(
          schedulingRequired,
          runtimeRestrictions,
          input.initiationMode,
        ),
        trace: {
          staleBinding,
          baseEffect: effect,
          runtimeRestrictions,
          blockedCallsByRisk,
        },
      });
    }

    return null;
  }

  private isSchedulingRequired(
    effect: PermissionEffect,
    protectedModeBlocked: boolean,
    conversationType: ConversationType,
    schedulingBiasForCalls: boolean,
  ): boolean {
    return (
      effect === PermissionEffect.AllowWithLimits ||
      protectedModeBlocked ||
      conversationType === ConversationType.ProtectedDirect ||
      schedulingBiasForCalls
    );
  }

  private buildProtectedRuntimeFlags(
    input: EnforceCallDto,
    protectedModeBlockedByRisk: boolean,
    conversationType: ConversationType,
  ): ProtectedCallRestrictionFlags {
    return {
      screenCaptureDetected: input.screenCaptureDetected === true,
      castingDetected: input.castingDetected === true,
      deviceIntegrityCompromised: input.deviceIntegrityCompromised === true,
      protectedModeBlockedByRisk,
      strictExpectationUnknownRuntime:
        conversationType === ConversationType.ProtectedDirect &&
        input.currentProtectedModeExpectation === true &&
        input.screenCaptureDetected === undefined,
    };
  }

  private createDecisionRestrictionSummary(
    schedulingRequired: boolean,
    runtimeRestrictions: ProtectedCallRestrictionFlags,
    initiationMode: CallInitiationMode,
  ): CallRestrictionSummary {
    const blockedByRuntimeRisk =
      runtimeRestrictions.screenCaptureDetected ||
      runtimeRestrictions.castingDetected ||
      runtimeRestrictions.deviceIntegrityCompromised ||
      runtimeRestrictions.strictExpectationUnknownRuntime;

    return {
      directAllowed: !schedulingRequired,
      requestAllowed: true,
      scheduledAllowed: true,
      protectedModeRequired: initiationMode !== CallInitiationMode.Request,
      protectedModeBlocked: runtimeRestrictions.protectedModeBlockedByRisk,
      schedulingRequired,
      blockedByRuntimeRisk,
    };
  }
}

function createRestrictionSummary(): CallRestrictionSummary {
  return {
    directAllowed: false,
    requestAllowed: false,
    scheduledAllowed: false,
    protectedModeRequired: false,
    protectedModeBlocked: false,
    schedulingRequired: false,
    blockedByRuntimeRisk: false,
  };
}
