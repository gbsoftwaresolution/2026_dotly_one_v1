import { apiRequest } from "@/lib/api/client";
import type {
  ConnectionType,
  IdentityConnection,
  ResolvedPermissionsMap,
  TrustState,
  PermissionEffect,
} from "@/types/connection";
import type { ExplainResponse, PermissionOverride } from "@/types/permissions";

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
    reason: data.finalReasonCode || "Derived from standard connection policies.",
    trace: stages
      .filter((s: any) => s.applied)
      .map((s: any) => `${s.label} (${s.stage})`),
  };
}

export const connectionsApi = {
  getConnection: (id: string) =>
    apiRequest<IdentityConnection>(`/identity-connections/${id}`),

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

  listPermissionOverrides: async (id: string): Promise<PermissionOverride[]> => {
    const data = await apiRequest<any[]>(`/identity-connections/${id}/permission-overrides`);
    return data.map(normalizeOverride);
  },

  updatePermissionOverride: async (
    id: string,
    key: string,
    effect: PermissionEffect,
    limitsJson?: Record<string, unknown>,
    reason?: string
  ): Promise<PermissionOverride> => {
    const data = await apiRequest<any>(
      `/identity-connections/${id}/permission-overrides/${key}`,
      {
        method: "PUT",
        body: { effect, limitsJson, reason },
      }
    );
    return normalizeOverride(data);
  },

  explainPermission: async (id: string, key: string): Promise<ExplainResponse> => {
    const data = await apiRequest<any>(
      `/identity-connections/${id}/permissions/${key}/explain`
    );
    return normalizeExplainResponse(data);
  },
};

export const {
  getConnection,
  updateConnectionType,
  updateTrustState,
  getResolvedPermissions,
  refreshResolvedPermissions,
  listPermissionOverrides,
  updatePermissionOverride,
  explainPermission,
} = connectionsApi;
