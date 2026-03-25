import { apiClient } from "./client";
import type {
  ExportResponse,
  PaginatedExportsResponse,
  ExportScopeType,
  PaginationParams,
} from "../types/api";

export const exportsApi = {
  list: async (
    params?: PaginationParams,
  ): Promise<PaginatedExportsResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.cursor) query.append("cursor", params.cursor);

    const res = await apiClient.get<{ exports: PaginatedExportsResponse }>(
      `/v1/exports?${query.toString()}`,
    );
    return res.exports;
  },

  create: async (
    scopeType: ExportScopeType,
    scopeData?: {
      albumId?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<ExportResponse> => {
    const res = await apiClient.post<{ export: ExportResponse }>(
      "/v1/exports",
      {
        scopeType,
        scopeAlbumId: scopeData?.albumId,
        scopeFrom: scopeData?.from,
        scopeTo: scopeData?.to,
      },
    );
    return res.export;
  },

  get: async (id: string): Promise<ExportResponse> => {
    const res = await apiClient.get<{ export: ExportResponse }>(
      `/v1/exports/${id}`,
    );
    return res.export;
  },

  getDownloadUrl: async (id: string): Promise<{ url: string }> => {
    const res = await apiClient.post<{
      downloadUrl: {
        url: string;
      };
    }>(`/v1/exports/${id}/download-url`);

    return { url: res.downloadUrl.url };
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/v1/exports/${id}`);
  },
};
