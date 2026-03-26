import { apiRequest } from "@/lib/api/client";
import type {
  CreateConnectionRequest,
  IdentityConnection,
  IdentityConnectionFilters,
} from "@/types/connection";
import type { CreateIdentityRequest, Identity } from "@/types/identity";

export const identitiesApi = {
  createIdentity: (data: CreateIdentityRequest) =>
    apiRequest<Identity>("/identities", {
      method: "POST",
      body: data,
    }),

  getIdentityConnections: (
    identityId: string,
    filters?: IdentityConnectionFilters,
  ) => {
    const params = new URLSearchParams();

    if (filters?.status) {
      params.set("status", filters.status);
    }

    const queryString = params.toString();

    return apiRequest<IdentityConnection[]>(
      `/identities/${identityId}/connections${
        queryString ? `?${queryString}` : ""
      }`,
    );
  },

  createConnection: (data: CreateConnectionRequest) =>
    apiRequest<IdentityConnection>("/identity-connections", {
      method: "POST",
      body: data,
    }),
};

export const { createIdentity, getIdentityConnections, createConnection } =
  identitiesApi;
