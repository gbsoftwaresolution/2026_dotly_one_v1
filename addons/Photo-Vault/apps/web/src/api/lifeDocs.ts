import { apiClient } from "./client";
import type {
  CreateLifeDocDto,
  LifeDocListResponse,
  LifeDocsFamilyOverviewResponse,
  LifeDocsRenewalSummaryResponse,
  LifeDocsSearchResponse,
  LifeDocsTimelineResponse,
  LifeDocResponse,
  LifeDocVersionsResponse,
  ReplaceLifeDocDto,
  SetLifeDocRenewalStateDto,
  UpdateLifeDocMaskedPrivacyDto,
  UpdateLifeDocRemindersDto,
  UpdateLifeDocDto,
} from "@booster-vault/shared";

type TimelineParams = {
  months?: number;
  ownerId?: string;
  category?: string;
  status?: string;
};

type SearchParams = {
  q: string;
  ownerId?: string;
  category?: string;
};

export const lifeDocsApi = {
  list: async (): Promise<LifeDocListResponse> => {
    return apiClient.get<LifeDocListResponse>("/v1/life-docs");
  },

  timeline: async (
    params: TimelineParams,
  ): Promise<LifeDocsTimelineResponse> => {
    const qs = new URLSearchParams();
    if (params.months) qs.set("months", String(params.months));
    if (params.ownerId) qs.set("ownerId", params.ownerId);
    if (params.category) qs.set("category", params.category);
    if (params.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<LifeDocsTimelineResponse>(
      `/v1/life-docs/timeline${suffix}`,
    );
  },

  search: async (params: SearchParams): Promise<LifeDocsSearchResponse> => {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.ownerId) qs.set("ownerId", params.ownerId);
    if (params.category) qs.set("category", params.category);
    return apiClient.get<LifeDocsSearchResponse>(
      `/v1/life-docs/search?${qs.toString()}`,
    );
  },

  familyOverview: async (): Promise<LifeDocsFamilyOverviewResponse> => {
    return apiClient.get<LifeDocsFamilyOverviewResponse>(
      "/v1/life-docs/family/overview",
    );
  },

  renewalSummary: async (): Promise<LifeDocsRenewalSummaryResponse> => {
    return apiClient.get<LifeDocsRenewalSummaryResponse>(
      "/v1/life-docs/renewal/summary",
    );
  },

  get: async (id: string): Promise<LifeDocResponse> => {
    return apiClient.get<LifeDocResponse>(`/v1/life-docs/${id}`);
  },

  getVersions: async (id: string): Promise<LifeDocVersionsResponse> => {
    return apiClient.get<LifeDocVersionsResponse>(
      `/v1/life-docs/${id}/versions`,
    );
  },

  restoreVersion: async (
    id: string,
    versionId: string,
  ): Promise<LifeDocResponse> => {
    return apiClient.post<LifeDocResponse>(
      `/v1/life-docs/${id}/versions/restore/${versionId}`,
      {},
    );
  },

  create: async (dto: CreateLifeDocDto): Promise<LifeDocResponse> => {
    return apiClient.post<LifeDocResponse>("/v1/life-docs", dto);
  },

  update: async (
    id: string,
    dto: UpdateLifeDocDto,
  ): Promise<LifeDocResponse> => {
    return apiClient.put<LifeDocResponse>(`/v1/life-docs/${id}`, dto);
  },

  setRenewalState: async (
    id: string,
    dto: SetLifeDocRenewalStateDto,
  ): Promise<LifeDocResponse> => {
    return apiClient.post<LifeDocResponse>(
      `/v1/life-docs/${id}/renewal/state`,
      dto,
    );
  },

  updateReminders: async (
    id: string,
    dto: UpdateLifeDocRemindersDto,
  ): Promise<LifeDocResponse> => {
    return apiClient.put<LifeDocResponse>(`/v1/life-docs/${id}/reminders`, dto);
  },

  testReminders: async (id: string): Promise<void> => {
    await apiClient.post(`/v1/life-docs/${id}/reminders/test`, {});
  },

  updateMaskedPrivacy: async (
    id: string,
    dto: UpdateLifeDocMaskedPrivacyDto,
  ): Promise<LifeDocResponse> => {
    return apiClient.put<LifeDocResponse>(
      `/v1/life-docs/${id}/privacy/masked`,
      dto,
    );
  },

  archive: async (id: string): Promise<void> => {
    await apiClient.post(`/v1/life-docs/${id}/archive`, {});
  },

  replace: async (
    id: string,
    dto: ReplaceLifeDocDto,
  ): Promise<LifeDocResponse> => {
    return apiClient.post<LifeDocResponse>(`/v1/life-docs/${id}/replace`, dto);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/life-docs/${id}`);
  },
};
