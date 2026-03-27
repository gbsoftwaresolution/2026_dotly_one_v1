import { apiRequest } from "@/lib/api/client";
import type {
  IdentityConnection,
  IdentityConnectionFilters,
} from "@/types/connection";
import type {
  ConversationStatus,
  IdentityConversationContext,
} from "@/types/conversation";
import type {
  CreateIdentityRequest,
  Identity,
  IdentityTeamAccessEntry,
  IdentityTeamAccessPayload,
} from "@/types/identity";
import { normalizeConversationContext } from "./connections";

export const identitiesApi = {
  listMyIdentities: () =>
    apiRequest<Identity[]>("/api/identities", {
      baseUrl: "",
      credentials: "same-origin",
    }),

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

  getIdentityInbox: async (input: {
    identityId: string;
    personaId?: string;
    status?: ConversationStatus;
  }) => {
    const params = new URLSearchParams();

    if (input.status) {
      params.set("status", input.status);
    }

    if (input.personaId) {
      params.set("personaId", input.personaId);
    }

    const queryString = params.toString();
    const data = await apiRequest<IdentityConversationContext[]>(
      `/identities/${input.identityId}/conversations${
        queryString ? `?${queryString}` : ""
      }`,
    );

    return data.map(normalizeConversationContext);
  },

  getIdentityTeamAccess: (identityId: string) =>
    apiRequest<IdentityTeamAccessPayload>(
      `/api/identities/${identityId}/team-access`,
      {
        baseUrl: "",
        credentials: "same-origin",
      },
    ),

  updateIdentityMemberPersonaAssignments: (
    identityId: string,
    memberId: string,
    personaIds: string[],
  ) =>
    apiRequest<IdentityTeamAccessEntry>(
      `/api/identities/${identityId}/team-access/members/${memberId}`,
      {
        method: "PUT",
        body: { personaIds },
        baseUrl: "",
        credentials: "same-origin",
      },
    ),

  updateIdentityOperatorPersonaAssignments: (
    identityId: string,
    operatorId: string,
    personaIds: string[],
  ) =>
    apiRequest<IdentityTeamAccessEntry>(
      `/api/identities/${identityId}/team-access/operators/${operatorId}`,
      {
        method: "PUT",
        body: { personaIds },
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};

export const {
  listMyIdentities,
  createIdentity,
  getIdentityConnections,
  getIdentityInbox,
  getIdentityTeamAccess,
  updateIdentityMemberPersonaAssignments,
  updateIdentityOperatorPersonaAssignments,
} = identitiesApi;
