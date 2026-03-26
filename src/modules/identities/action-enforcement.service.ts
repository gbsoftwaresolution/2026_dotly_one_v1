import { Injectable } from "@nestjs/common";

import { PermissionEffect } from "../../common/enums/permission-effect.enum";
import { IdentityType } from "../../common/enums/identity-type.enum";

import {
  ActionDecisionEffect,
  ActionType,
  type ActionDecision,
  type ActionDecisionReasonCode,
  type ActionPermissionDefinition,
  getActionPermissionDefinition,
} from "./action-permission";
import { EnforceActionDto } from "./dto/enforce-action.dto";
import {
  ConversationStatus,
  ConversationType,
  type IdentityBehaviorRuleSummary,
} from "./identity.types";
import { getIdentityTypeBehavior } from "./identity-type-behaviors";
import { IdentitiesService } from "./identities.service";
import { PERMISSION_KEYS, type PermissionKey } from "./permission-keys";

@Injectable()
export class ActionEnforcementService {
  constructor(private readonly identitiesService: IdentitiesService) {}

  async enforceAction(input: EnforceActionDto): Promise<ActionDecision> {
    const context = await this.identitiesService.resolveConversationContext({
      conversationId: input.conversationId,
    });
    const staleCheck =
      await this.identitiesService.isConversationPermissionBindingStale(
        input.conversationId,
      );
    const boundPermissions = staleCheck.stale
      ? await this.identitiesService.bindResolvedPermissionsToConversation({
          conversationId: input.conversationId,
        })
      : null;
    const resolvedPermissions =
      boundPermissions?.resolvedConnectionPermissions ??
      context.resolvedPermissions;
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
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_INVALID_ACTOR",
        reasons: ["Actor is not part of this conversation"],
        trace: {
          staleBinding: staleCheck.stale,
          conversationStatus: conversation.conversationStatus,
          conversationType: conversation.conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    const stateDecision = this.enforceConversationState(
      conversation.conversationStatus,
      input.actionType,
      input,
      staleCheck.stale,
      conversation.conversationType,
    );

    if (stateDecision) {
      return stateDecision;
    }

    const actionDefinition = this.mapActionToPermissionKey(input.actionType);

    if (!actionDefinition) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_PERMISSION",
        reasons: ["Unknown action type"],
        trace: {
          staleBinding: staleCheck.stale,
          conversationStatus: conversation.conversationStatus,
          conversationType: conversation.conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    const resolvedPermission =
      resolvedPermissions.permissions[actionDefinition.permissionKey];

    if (!resolvedPermission) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_PERMISSION",
        reasons: ["Missing permission resolution"],
        trace: {
          staleBinding: staleCheck.stale,
          conversationStatus: conversation.conversationStatus,
          conversationType: conversation.conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    const identityBehaviorDecision = this.applyIdentityBehaviorToActionDecision(
      input,
      actionDefinition,
      identityBehaviorSummary,
      staleCheck.stale,
      conversation.conversationStatus,
      conversation.conversationType,
      resolvedPermission.finalEffect,
    );

    if (identityBehaviorDecision) {
      return identityBehaviorDecision;
    }

    const protectedModeDecision = this.enforceProtectedConversationOverrides(
      conversation.conversationType,
      input.actionType,
      actionDefinition.permissionKey,
      input,
      staleCheck.stale,
      resolvedPermission.finalEffect,
    );

    if (protectedModeDecision) {
      return protectedModeDecision;
    }

    const permissionDecision = this.evaluateBasePermission(
      resolvedPermission.finalEffect,
      input,
      actionDefinition,
      staleCheck.stale,
      conversation.conversationStatus,
      conversation.conversationType,
    );

    if (
      permissionDecision.effect === ActionDecisionEffect.Deny ||
      permissionDecision.effect === ActionDecisionEffect.RequestApproval
    ) {
      return permissionDecision;
    }

    const contentDecision = await this.enforceContentIfNeeded(
      input,
      actionDefinition,
      resolvedPermissions,
      staleCheck.stale,
      conversation.conversationStatus,
      conversation.conversationType,
    );

    if (
      contentDecision &&
      contentDecision.effect === ActionDecisionEffect.Deny
    ) {
      return contentDecision;
    }

    const riskDecision = this.enforceRiskSummary(
      input,
      actionDefinition,
      resolvedPermissions.riskSummary,
      staleCheck.stale,
      conversation.conversationStatus,
      conversation.conversationType,
      resolvedPermission.finalEffect,
      contentDecision?.trace?.contentEffect ?? null,
    );

    if (riskDecision) {
      return riskDecision;
    }

    if (
      permissionDecision.effect === ActionDecisionEffect.AllowWithLimits ||
      contentDecision?.effect === ActionDecisionEffect.AllowWithLimits
    ) {
      return this.buildDecision({
        allowed: true,
        effect: ActionDecisionEffect.AllowWithLimits,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_ALLOWED_WITH_LIMITS",
        reasons: ["Action allowed with limits"],
        trace: {
          staleBinding: staleCheck.stale,
          conversationStatus: conversation.conversationStatus,
          conversationType: conversation.conversationType,
          baseEffect: resolvedPermission.finalEffect,
          contentEffect: contentDecision?.trace?.contentEffect ?? null,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    return this.buildDecision({
      allowed: true,
      effect: ActionDecisionEffect.Allow,
      actionType: input.actionType,
      permissionKey: actionDefinition.permissionKey,
      conversationId: input.conversationId,
      actorIdentityId: input.actorIdentityId,
      reasonCode: "ACTION_ALLOWED",
      reasons: ["Action allowed"],
      trace: {
        staleBinding: staleCheck.stale,
        conversationStatus: conversation.conversationStatus,
        conversationType: conversation.conversationType,
        baseEffect: resolvedPermission.finalEffect,
        contentEffect: contentDecision?.trace?.contentEffect ?? null,
        contentAction: actionDefinition.contentAction,
      },
    });
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

  mapActionToPermissionKey(
    actionType: ActionType | string,
  ): ActionPermissionDefinition | null {
    return getActionPermissionDefinition(actionType);
  }

  async enforceContentIfNeeded(
    input: EnforceActionDto,
    actionDefinition: ActionPermissionDefinition,
    resolvedPermissions: {
      connectionId: string;
      targetIdentityId: string;
    },
    staleBinding: boolean,
    conversationStatus: ConversationStatus,
    conversationType: ConversationType,
  ): Promise<ActionDecision | null> {
    if (!input.contentId || !actionDefinition.contentAction) {
      return null;
    }

    const contentResolution =
      await this.identitiesService.resolveContentPermissionsForConnection({
        connectionId: resolvedPermissions.connectionId,
        contentId: input.contentId,
        targetIdentityId: resolvedPermissions.targetIdentityId,
        currentViewCount: input.currentViewCount,
      });
    const effectiveContentPermission =
      contentResolution.effectiveContentPermissions[
        actionDefinition.contentAction
      ];

    if (!effectiveContentPermission) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONTENT_RULE",
        reasons: ["Missing content permission resolution"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    if (effectiveContentPermission.effect === PermissionEffect.Deny) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONTENT_RULE",
        reasons: ["Content rule denied this action"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: effectiveContentPermission.effect,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    if (
      effectiveContentPermission.effect === PermissionEffect.AllowWithLimits
    ) {
      return this.buildDecision({
        allowed: true,
        effect: ActionDecisionEffect.AllowWithLimits,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_ALLOWED_WITH_LIMITS",
        reasons: ["Content rule allows this action with limits"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: effectiveContentPermission.effect,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    return this.buildDecision({
      allowed: true,
      effect: ActionDecisionEffect.Allow,
      actionType: input.actionType,
      permissionKey: actionDefinition.permissionKey,
      conversationId: input.conversationId,
      actorIdentityId: input.actorIdentityId,
      reasonCode: "ACTION_ALLOWED",
      reasons: ["Content rule allows this action"],
      trace: {
        staleBinding,
        conversationStatus,
        conversationType,
        baseEffect: null,
        contentEffect: effectiveContentPermission.effect,
        contentAction: actionDefinition.contentAction,
      },
    });
  }

  buildDecision(input: Omit<ActionDecision, "evaluatedAt">): ActionDecision {
    return {
      ...input,
      evaluatedAt: new Date(),
    };
  }

  private enforceConversationState(
    conversationStatus: ConversationStatus,
    actionType: ActionType,
    input: EnforceActionDto,
    staleBinding: boolean,
    conversationType: ConversationType,
  ): ActionDecision | null {
    if (conversationStatus === ConversationStatus.Blocked) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONVERSATION_STATE",
        reasons: ["Conversation is blocked"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    if (conversationStatus === ConversationStatus.Locked) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONVERSATION_STATE",
        reasons: ["Conversation is locked"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    if (conversationStatus === ConversationStatus.Archived) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType,
        permissionKey: null,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONVERSATION_STATE",
        reasons: ["Conversation is archived"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect: null,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    return null;
  }

  private evaluateBasePermission(
    effect: PermissionEffect,
    input: EnforceActionDto,
    actionDefinition: ActionPermissionDefinition,
    staleBinding: boolean,
    conversationStatus: ConversationStatus,
    conversationType: ConversationType,
  ): ActionDecision {
    switch (effect) {
      case PermissionEffect.Deny:
        return this.buildDecision({
          allowed: false,
          effect: ActionDecisionEffect.Deny,
          actionType: input.actionType,
          permissionKey: actionDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          reasonCode: "ACTION_DENIED_PERMISSION",
          reasons: ["Resolved permission denied this action"],
          trace: {
            staleBinding,
            conversationStatus,
            conversationType,
            baseEffect: effect,
            contentEffect: null,
            contentAction: actionDefinition.contentAction,
          },
        });
      case PermissionEffect.RequestApproval:
        return this.buildDecision({
          allowed: false,
          effect: ActionDecisionEffect.RequestApproval,
          actionType: input.actionType,
          permissionKey: actionDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          reasonCode: "ACTION_REQUEST_APPROVAL",
          reasons: ["Action requires approval"],
          trace: {
            staleBinding,
            conversationStatus,
            conversationType,
            baseEffect: effect,
            contentEffect: null,
            contentAction: actionDefinition.contentAction,
          },
        });
      case PermissionEffect.AllowWithLimits:
        return this.buildDecision({
          allowed: true,
          effect: ActionDecisionEffect.AllowWithLimits,
          actionType: input.actionType,
          permissionKey: actionDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          reasonCode: "ACTION_ALLOWED_WITH_LIMITS",
          reasons: ["Resolved permission allows this action with limits"],
          trace: {
            staleBinding,
            conversationStatus,
            conversationType,
            baseEffect: effect,
            contentEffect: null,
            contentAction: actionDefinition.contentAction,
          },
        });
      case PermissionEffect.Allow:
      default:
        return this.buildDecision({
          allowed: true,
          effect: ActionDecisionEffect.Allow,
          actionType: input.actionType,
          permissionKey: actionDefinition.permissionKey,
          conversationId: input.conversationId,
          actorIdentityId: input.actorIdentityId,
          reasonCode: "ACTION_ALLOWED",
          reasons: ["Resolved permission allows this action"],
          trace: {
            staleBinding,
            conversationStatus,
            conversationType,
            baseEffect: effect,
            contentEffect: null,
            contentAction: actionDefinition.contentAction,
          },
        });
    }
  }

  private enforceRiskSummary(
    input: EnforceActionDto,
    actionDefinition: ActionPermissionDefinition,
    riskSummary: {
      blockedProtectedMode: boolean;
      blockedCalls: boolean;
      aiRestricted: boolean;
    },
    staleBinding: boolean,
    conversationStatus: ConversationStatus,
    conversationType: ConversationType,
    baseEffect: PermissionEffect,
    contentEffect: PermissionEffect | null,
  ): ActionDecision | null {
    if (
      actionDefinition.category === "CALL" &&
      riskSummary.blockedCalls === true
    ) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_RISK",
        reasons: ["Risk policy blocks calls"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect,
          contentEffect,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    if (
      input.actionType === ActionType.SendProtectedMedia &&
      riskSummary.blockedProtectedMode === true
    ) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_RISK",
        reasons: ["Risk policy blocks protected mode"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect,
          contentEffect,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    if (
      (input.actionType === ActionType.AiSummary ||
        input.actionType === ActionType.AiReply) &&
      riskSummary.aiRestricted === true
    ) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_RISK",
        reasons: ["Risk policy blocks AI usage"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect,
          contentEffect,
          contentAction: actionDefinition.contentAction,
        },
      });
    }

    return null;
  }

  private enforceProtectedConversationOverrides(
    conversationType: ConversationType,
    actionType: ActionType,
    permissionKey: PermissionKey,
    input: EnforceActionDto,
    staleBinding: boolean,
    baseEffect: PermissionEffect,
  ): ActionDecision | null {
    if (conversationType !== ConversationType.ProtectedDirect) {
      return null;
    }

    if (
      permissionKey === PERMISSION_KEYS.mediaPrivacy.export ||
      actionType === ActionType.ExportContent ||
      actionType === ActionType.ExportMedia
    ) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_CONVERSATION_STATE",
        reasons: ["Protected direct conversations block export"],
        trace: {
          staleBinding,
          conversationStatus: ConversationStatus.Active,
          conversationType,
          baseEffect,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    if (
      actionType === ActionType.ForwardMedia ||
      actionType === ActionType.ForwardContent
    ) {
      return this.buildDecision({
        allowed: true,
        effect: ActionDecisionEffect.AllowWithLimits,
        actionType,
        permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_ALLOWED_WITH_LIMITS",
        reasons: ["Protected direct conversations restrict forwarding"],
        trace: {
          staleBinding,
          conversationStatus: ConversationStatus.Active,
          conversationType,
          baseEffect,
          contentEffect: null,
          contentAction: null,
        },
      });
    }

    return null;
  }

  private applyIdentityBehaviorToActionDecision(
    input: EnforceActionDto,
    actionDefinition: ActionPermissionDefinition,
    pairBehaviorSummary: IdentityBehaviorRuleSummary,
    staleBinding: boolean,
    conversationStatus: ConversationStatus,
    conversationType: ConversationType,
    baseEffect: PermissionEffect,
  ): ActionDecision | null {
    const exportRestricted =
      pairBehaviorSummary.restrictionFlags.exportRestricted &&
      (input.actionType === ActionType.ExportMedia ||
        input.actionType === ActionType.ExportContent);
    const reshareRestricted =
      pairBehaviorSummary.restrictionFlags.reshareRestricted &&
      (input.actionType === ActionType.ForwardMedia ||
        input.actionType === ActionType.ForwardContent);

    if (exportRestricted) {
      return this.buildDecision({
        allowed: false,
        effect: ActionDecisionEffect.Deny,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_DENIED_PERMISSION",
        reasons: ["Identity behavior restricts export for this pair context"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect,
          contentEffect: null,
          contentAction: actionDefinition.contentAction,
          identityBehaviorApplied: true,
          identityBehaviorReasonCodes: pairBehaviorSummary.reasonCodes,
          identityBehaviorSummary: pairBehaviorSummary,
        },
      });
    }

    if (reshareRestricted) {
      return this.buildDecision({
        allowed: true,
        effect: ActionDecisionEffect.AllowWithLimits,
        actionType: input.actionType,
        permissionKey: actionDefinition.permissionKey,
        conversationId: input.conversationId,
        actorIdentityId: input.actorIdentityId,
        reasonCode: "ACTION_ALLOWED_WITH_LIMITS",
        reasons: ["Identity behavior limits reshare for this pair context"],
        trace: {
          staleBinding,
          conversationStatus,
          conversationType,
          baseEffect,
          contentEffect: null,
          contentAction: actionDefinition.contentAction,
          identityBehaviorApplied: true,
          identityBehaviorReasonCodes: pairBehaviorSummary.reasonCodes,
          identityBehaviorSummary: pairBehaviorSummary,
        },
      });
    }

    return null;
  }
}
