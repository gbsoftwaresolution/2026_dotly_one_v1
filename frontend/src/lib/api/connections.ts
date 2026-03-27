import { apiRequest } from "@/lib/api/client";
import type {
  ConnectionType,
  IdentityConnection,
  ResolvedPermissionsMap,
  TrustState,
  PermissionEffect,
} from "@/types/connection";
import type {
  ConversationStatus,
  ConversationType,
  IdentityConversationContext,
} from "@/types/conversation";
import type {
  ExplainResponse,
  PermissionOverride,
  ResolvedPermissionsExplanation,
} from "@/types/permissions";

// --- Normalizers ---

function normalizeOverride(data: any): PermissionOverride {
  return {
    key: data.permissionKey,
    effect: data.effect,
    limitsJson: data.limits ?? data.limitsJson ?? null,
    reason: data.reason ?? null,
    createdAt: data.createdAt,
  };
}

function normalizeExplainResponse(data: any): ExplainResponse {
  const stages = Array.isArray(data.stages) ? data.stages : [];
  return {
    key: data.permissionKey,
    finalEffect: data.finalEffect,
    reason:
      data.finalReasonCode || "Derived from standard connection policies.",
    reasonCode: data.finalReasonCode ?? null,
    explanationText: data.explanationText ?? null,
    trace: stages
      .filter((s: any) => s.applied)
      .map((s: any) => `${s.label} (${s.stage})`),
  };
}

function normalizeConversationContext(data: any): IdentityConversationContext {
  return {
    conversationId: data.conversationId,
    connectionId: data.connectionId,
    personaId: data.personaId ?? null,
    sourceIdentityId: data.sourceIdentityId,
    targetIdentityId: data.targetIdentityId,
    conversationType: data.conversationType as ConversationType,
    conversationStatus: data.conversationStatus as ConversationStatus,
    title: data.title ?? null,
    metadataJson: data.metadataJson ?? null,
    lastResolvedAt: data.lastResolvedAt ?? null,
    lastPermissionHash: data.lastPermissionHash ?? null,
    createdByIdentityId: data.createdByIdentityId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function normalizeResolvedPermissionsExplanation(
  data: any,
): ResolvedPermissionsExplanation {
  const permissions = Array.isArray(data.permissions)
    ? data.permissions.map((permission: any) => ({
        key: permission.permissionKey,
        finalEffect: permission.finalEffect,
        reasonCode: permission.finalReasonCode ?? null,
        explanationText: permission.explanationText ?? null,
      }))
    : undefined;

  return {
    summaryText:
      data.summaryText ??
      "Protected restrictions are derived from backend policy resolution.",
    blockedPermissionKeys: Array.isArray(data.blockedPermissionKeys)
      ? data.blockedPermissionKeys
      : [],
    protectedPermissionKeys: Array.isArray(data.protectedPermissionKeys)
      ? data.protectedPermissionKeys
      : [],
    permissions,
  };
}

export const connectionsApi = {
  getConnection: (id: string) =>
    apiRequest<IdentityConnection>(`/identity-connections/${id}`),

  getConversationContext: async (
    conversationId: string,
  ): Promise<IdentityConversationContext> => {
    const data = await apiRequest<any>(
      `/identity-conversations/${conversationId}`,
    );
    return normalizeConversationContext(data);
  },

  listConversationsForIdentity: async (
    identityId: string,
    status?: ConversationStatus,
    personaId?: string,
  ): Promise<IdentityConversationContext[]> => {
    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }

    if (personaId) {
      params.set("personaId", personaId);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const data = await apiRequest<any[]>(
      `/identities/${identityId}/conversations${suffix}`,
    );
    return data.map(normalizeConversationContext);
  },

  createConversation: async (input: {
    sourceIdentityId: string;
    targetIdentityId: string;
    connectionId: string;
    conversationType: ConversationType;
    createdByIdentityId: string;
    personaId?: string;
  }): Promise<IdentityConversationContext> => {
    const data = await apiRequest<any>("/identity-conversations", {
      method: "POST",
      body: input,
    });
    return normalizeConversationContext(data);
  },

  getOrCreateConversation: async (input: {
    sourceIdentityId: string;
    targetIdentityId: string;
    connectionId: string;
    conversationType: ConversationType;
    createdByIdentityId: string;
    personaId?: string;
  }): Promise<IdentityConversationContext> => {
    const data = await apiRequest<any>(
      "/identity-conversations/get-or-create",
      {
        method: "POST",
        body: input,
      },
    );
    return normalizeConversationContext(data);
  },

  updateConnectionType: (id: string, type: ConnectionType) =>
    apiRequest<IdentityConnection>(`/identity-connections/${id}/type`, {
      method: "PATCH",
      body: { connectionType: type },
    }),

  updateTrustState: (id: string, state: TrustState) =>
    apiRequest<IdentityConnection>(`/identity-connections/${id}/trust-state`, {
      method: "PATCH",
      body: { trustState: state },
    }),

  getResolvedPermissions: (id: string) =>
    apiRequest<ResolvedPermissionsMap>(
      `/identity-connections/${id}/resolved-permissions?preferCache=true`,
    ),

  refreshResolvedPermissions: (id: string) =>
    apiRequest<ResolvedPermissionsMap>(
      `/identity-connections/${id}/resolved-permissions?forceRefresh=true`,
    ),

  listPermissionOverrides: async (
    id: string,
  ): Promise<PermissionOverride[]> => {
    const data = await apiRequest<any[]>(
      `/identity-connections/${id}/permission-overrides`,
    );
    return data.map(normalizeOverride);
  },

  updatePermissionOverride: async (
    id: string,
    key: string,
    effect: PermissionEffect,
    limitsJson?: Record<string, unknown>,
    reason?: string,
  ): Promise<PermissionOverride> => {
    const data = await apiRequest<any>(
      `/identity-connections/${id}/permission-overrides/${key}`,
      {
        method: "PUT",
        body: { effect, limitsJson, reason },
      },
    );
    return normalizeOverride(data);
  },

  explainPermission: async (
    id: string,
    key: string,
  ): Promise<ExplainResponse> => {
    const data = await apiRequest<any>(
      `/identity-connections/${id}/permissions/${key}/explain`,
    );
    return normalizeExplainResponse(data);
  },

  explainResolvedPermissions: async (
    id: string,
  ): Promise<ResolvedPermissionsExplanation> => {
    const data = await apiRequest<any>(
      `/identity-connections/${id}/permissions/explain?preferCache=true`,
    );
    return normalizeResolvedPermissionsExplanation(data);
  },
};

export const {
  getConnection,
  getConversationContext,
  listConversationsForIdentity,
  createConversation,
  getOrCreateConversation,
  updateConnectionType,
  updateTrustState,
  getResolvedPermissions,
  refreshResolvedPermissions,
  listPermissionOverrides,
  updatePermissionOverride,
  explainPermission,
  explainResolvedPermissions,
} = connectionsApi;
