import { Injectable } from "@nestjs/common";

import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { TrustState } from "../../common/enums/trust-state.enum";

import {
  AICapability,
  AICapabilityDecision,
  AIExecutionContext,
  AIReasonCode,
  AIRestrictionLevel,
  mapAICapabilityToPermissionKey,
} from "./ai-permission";
import { EnforceAICapabilityDto } from "./dto/enforce-ai-capability.dto";
import { ConversationType } from "./identity.types";
import { IdentitiesService } from "./identities.service";
import { PermissionAuditEventType } from "./permission-audit";
import { type PermissionKey } from "./permission-keys";
import { RiskSignal } from "./risk-engine";

@Injectable()
export class AIEnforcementService {
  constructor(private readonly identitiesService: IdentitiesService) {}

  async enforceAICapability(
    input: EnforceAICapabilityDto,
  ): Promise<AICapabilityDecision> {
    const context = await this.identitiesService.resolveConversationContext({
      conversationId: input.conversationId,
      currentUserId: input.currentUserId,
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
        {
          conversationId: input.conversationId,
          currentUserId: input.currentUserId,
        },
      );
    const rebound = staleCheck.stale
      ? await this.identitiesService.bindResolvedPermissionsToConversation({
          conversationId: input.conversationId,
          currentUserId: input.currentUserId,
        })
      : null;
    const resolvedPermissions =
      rebound?.resolvedConnectionPermissions ?? context.resolvedPermissions;
    const conversation = context.conversation;

    if (
      !this.validateActorInConversation(input.actorIdentityId, conversation)
    ) {
      return this.finalizeDecision(
        this.buildAIDecision({
          allowed: false,
          restrictionLevel: AIRestrictionLevel.Denied,
          capability: input.capability,
          permissionKey: null,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          contextType: input.contextType,
          reasonCode: AIReasonCode.DeniedContext,
          reasons: ["Actor is not part of this conversation"],
          trace: this.createTrace({
            staleBinding: staleCheck.stale,
            conversationType: conversation.conversationType,
          }),
        }),
        resolvedPermissions.connectionId,
      );
    }

    const permissionKey = this.mapAICapabilityToPermissionKey(input.capability);

    if (!permissionKey) {
      return this.finalizeDecision(
        this.buildAIDecision({
          allowed: false,
          restrictionLevel: AIRestrictionLevel.Denied,
          capability: input.capability,
          permissionKey: null,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          contextType: input.contextType,
          reasonCode: AIReasonCode.DeniedPermission,
          reasons: ["Unknown AI capability"],
          trace: this.createTrace({
            staleBinding: staleCheck.stale,
            conversationType: conversation.conversationType,
          }),
        }),
        resolvedPermissions.connectionId,
      );
    }

    const resolvedPermission = resolvedPermissions.permissions[permissionKey];

    if (!resolvedPermission) {
      return this.finalizeDecision(
        this.buildAIDecision({
          allowed: false,
          restrictionLevel: AIRestrictionLevel.Denied,
          capability: input.capability,
          permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          contextType: input.contextType,
          reasonCode: AIReasonCode.DeniedPermission,
          reasons: ["Missing AI permission resolution"],
          trace: this.createTrace({
            staleBinding: staleCheck.stale,
            conversationType: conversation.conversationType,
          }),
        }),
        resolvedPermissions.connectionId,
      );
    }

    const basePermissionDecision = this.evaluateBasePermission(
      resolvedPermission.finalEffect,
      input,
      permissionKey,
      staleCheck.stale,
      conversation.conversationType,
    );

    if (basePermissionDecision) {
      return this.finalizeDecision(
        basePermissionDecision,
        resolvedPermissions.connectionId,
      );
    }

    const contentDecision = await this.enforceAIContentRules(
      input,
      resolvedPermissions.connectionId,
      resolvedPermissions.targetIdentityId,
      staleCheck.stale,
      conversation.conversationType,
      permissionKey,
    );

    if (contentDecision) {
      return this.finalizeDecision(
        contentDecision,
        resolvedPermissions.connectionId,
      );
    }

    const vaultDecision = this.enforceAIVaultRules(
      input,
      resolvedPermissions,
      staleCheck.stale,
      conversation.conversationType,
      permissionKey,
    );

    if (vaultDecision) {
      return this.finalizeDecision(
        vaultDecision,
        resolvedPermissions.connectionId,
      );
    }

    const riskDecision = this.enforceAIRiskRules(
      input,
      resolvedPermissions.riskSummary,
      resolvedPermissions.trustState,
      staleCheck.stale,
      conversation.conversationType,
      permissionKey,
    );

    if (riskDecision) {
      return this.finalizeDecision(
        riskDecision,
        resolvedPermissions.connectionId,
      );
    }

    const protectedDecision = this.enforceProtectedContextRules(
      input,
      staleCheck.stale,
      conversation.conversationType,
      permissionKey,
      input.isProtectedContent ?? false,
    );

    if (protectedDecision) {
      return this.finalizeDecision(
        protectedDecision,
        resolvedPermissions.connectionId,
      );
    }

    return this.finalizeDecision(
      this.buildAIDecision({
        allowed: true,
        restrictionLevel: AIRestrictionLevel.Full,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.Allowed,
        reasons: ["AI capability allowed within resolved permissions"],
        trace: this.createTrace({
          staleBinding: staleCheck.stale,
          conversationType: conversation.conversationType,
          baseEffect: resolvedPermission.finalEffect,
          protectedContent: input.isProtectedContent ?? false,
          vaultContent: input.isVaultContent ?? false,
          riskSignals: resolvedPermissions.riskSummary.appliedSignals,
        }),
      }),
      resolvedPermissions.connectionId,
    );
  }

  mapAICapabilityToPermissionKey(
    capability: AICapability | string,
  ): PermissionKey | null {
    return mapAICapabilityToPermissionKey(capability);
  }

  async enforceAIContentRules(
    input: EnforceAICapabilityDto,
    connectionId: string,
    targetIdentityId: string,
    staleBinding: boolean,
    conversationType: ConversationType,
    permissionKey: PermissionKey,
  ): Promise<AICapabilityDecision | null> {
    if (!input.contentId) {
      return null;
    }

    const contentResolution =
      await this.identitiesService.resolveContentPermissionsForConnection({
        connectionId,
        contentId: input.contentId,
        targetIdentityId,
      });

    const aiAccess =
      contentResolution.effectiveContentPermissions["content.ai_access"];

    if (!aiAccess || aiAccess.effect === PermissionEffect.Deny) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode:
          contentResolution.contentSummary.aiAccessAllowed === false
            ? AIReasonCode.ExplicitlyDisabled
            : AIReasonCode.DeniedContentRule,
        reasons:
          contentResolution.contentSummary.aiAccessAllowed === false
            ? ["Content explicitly disables AI access"]
            : ["Content rules deny AI access"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          contentAiEffect: aiAccess?.effect ?? PermissionEffect.Deny,
        }),
      });
    }

    if (
      contentResolution.restrictionSummary.expired ||
      contentResolution.restrictionSummary.viewLimitReached
    ) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedContentRule,
        reasons: ["Content is expired or view-limited for AI access"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          contentAiEffect: aiAccess.effect,
        }),
      });
    }

    return null;
  }

  enforceAIVaultRules(
    input: EnforceAICapabilityDto,
    resolvedPermissions: Awaited<
      ReturnType<IdentitiesService["resolveConnectionPermissions"]>
    >,
    staleBinding: boolean,
    conversationType: ConversationType,
    permissionKey: PermissionKey,
  ): AICapabilityDecision | null {
    if (
      !input.isVaultContent &&
      input.contextType !== AIExecutionContext.VaultItem
    ) {
      return null;
    }

    const vaultViewEffect =
      resolvedPermissions.permissions["vault.item.view"]?.finalEffect ??
      PermissionEffect.Deny;

    if (vaultViewEffect !== PermissionEffect.Allow) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedVault,
        reasons: ["Vault AI access requires explicit vault view permission"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          vaultViewEffect,
          vaultContent: true,
        }),
      });
    }

    if (!input.contentId) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedVault,
        reasons: [
          "Vault AI access requires explicit content-level AI allowance",
        ],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          vaultViewEffect,
          vaultContent: true,
        }),
      });
    }

    return null;
  }

  enforceAIRiskRules(
    input: EnforceAICapabilityDto,
    riskSummary: {
      appliedSignals: RiskSignal[];
      aiRestricted: boolean;
    },
    trustState: TrustState,
    staleBinding: boolean,
    conversationType: ConversationType,
    permissionKey: PermissionKey,
  ): AICapabilityDecision | null {
    const appliedSignals = riskSummary.appliedSignals;

    if (
      trustState === TrustState.HighRisk ||
      riskSummary.aiRestricted === true ||
      appliedSignals.includes(RiskSignal.AiSafetyRisk) ||
      appliedSignals.includes(RiskSignal.DeviceCompromised) ||
      appliedSignals.includes(RiskSignal.HighFraudProbability)
    ) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedRisk,
        reasons: ["Risk policy blocks AI capability"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          riskSignals: appliedSignals,
        }),
      });
    }

    if (appliedSignals.includes(RiskSignal.RateLimited)) {
      return this.buildAIDecision({
        allowed: true,
        restrictionLevel: AIRestrictionLevel.Limited,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.Limited,
        reasons: ["Risk policy rate-limits AI capability"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          riskSignals: appliedSignals,
        }),
      });
    }

    return null;
  }

  buildAIDecision(
    decision: Omit<AICapabilityDecision, "evaluatedAt">,
  ): AICapabilityDecision {
    return {
      ...decision,
      evaluatedAt: new Date(),
    };
  }

  private finalizeDecision(
    decision: AICapabilityDecision,
    connectionId: string | null,
  ): AICapabilityDecision {
    const auditResult = this.identitiesService.safeRecordPermissionAuditEvent?.(
      {
        eventType: PermissionAuditEventType.AIEnforced,
        connectionId,
        conversationId: decision.conversationId,
        permissionKey: decision.permissionKey,
        actorIdentityId: decision.actorIdentityId,
        summaryText: `AI capability ${decision.capability} evaluated as ${decision.restrictionLevel}.`,
        payloadJson: {
          allowed: decision.allowed,
          restrictionLevel: decision.restrictionLevel,
          reasonCode: decision.reasonCode,
          reasons: decision.reasons,
          trace: decision.trace,
        },
      },
    );

    void Promise.resolve(auditResult).catch(() => undefined);

    return decision;
  }

  private validateActorInConversation(
    actorIdentityId: string,
    conversation: {
      sourceIdentityId: string;
      targetIdentityId: string;
    },
  ) {
    return (
      actorIdentityId === conversation.sourceIdentityId ||
      actorIdentityId === conversation.targetIdentityId
    );
  }

  private evaluateBasePermission(
    effect: PermissionEffect,
    input: EnforceAICapabilityDto,
    permissionKey: PermissionKey,
    staleBinding: boolean,
    conversationType: ConversationType,
  ): AICapabilityDecision | null {
    if (effect === PermissionEffect.Deny) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedPermission,
        reasons: ["AI permission denies this capability"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          baseEffect: effect,
        }),
      });
    }

    if (effect === PermissionEffect.RequestApproval) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedPermission,
        reasons: ["AI cannot auto-request approval for this capability"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          baseEffect: effect,
        }),
      });
    }

    if (effect === PermissionEffect.AllowWithLimits) {
      return this.buildAIDecision({
        allowed: true,
        restrictionLevel: AIRestrictionLevel.Limited,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.Limited,
        reasons: ["AI capability allowed with limits"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          baseEffect: effect,
        }),
      });
    }

    return null;
  }

  private enforceProtectedContextRules(
    input: EnforceAICapabilityDto,
    staleBinding: boolean,
    conversationType: ConversationType,
    permissionKey: PermissionKey,
    protectedContent: boolean,
  ): AICapabilityDecision | null {
    if (
      conversationType !== ConversationType.ProtectedDirect &&
      !protectedContent
    ) {
      return null;
    }

    if (input.capability === AICapability.ExtractActions) {
      return this.buildAIDecision({
        allowed: false,
        restrictionLevel: AIRestrictionLevel.Denied,
        capability: input.capability,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        contextType: input.contextType,
        reasonCode: AIReasonCode.DeniedContext,
        reasons: ["Protected contexts deny AI action extraction"],
        trace: this.createTrace({
          staleBinding,
          conversationType,
          protectedContextApplied: true,
          protectedContent,
        }),
      });
    }

    return this.buildAIDecision({
      allowed: true,
      restrictionLevel: AIRestrictionLevel.Limited,
      capability: input.capability,
      permissionKey,
      conversationId: input.conversationId,
      actorIdentityId: input.actorIdentityId,
      contextType: input.contextType,
      reasonCode: AIReasonCode.Limited,
      reasons: ["Protected contexts limit AI capabilities"],
      trace: this.createTrace({
        staleBinding,
        conversationType,
        protectedContextApplied: true,
        protectedContent,
      }),
    });
  }

  private createTrace(overrides?: Partial<AICapabilityDecision["trace"]>) {
    return {
      staleBinding: false,
      conversationType: null,
      baseEffect: null,
      contentAiEffect: null,
      vaultViewEffect: null,
      protectedContextApplied: false,
      vaultContent: false,
      protectedContent: false,
      riskSignals: [],
      ...overrides,
    };
  }
}
