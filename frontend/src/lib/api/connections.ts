import { apiRequest } from "@/lib/api/client";
import type {
  ConnectionType,
  IdentityConnection,
  ResolvedPermissionsMap,
  TrustState,
} from "@/types/connection";

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
};

export const {
  getConnection,
  updateConnectionType,
  updateTrustState,
  getResolvedPermissions,
} = connectionsApi;
