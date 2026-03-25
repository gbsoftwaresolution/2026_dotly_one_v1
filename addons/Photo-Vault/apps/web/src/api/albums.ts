import { apiClient } from "./client";
import type {
  AlbumResponse,
  PaginatedAlbumResponse,
  PaginatedAlbumItemsResponse,
  PaginationParams,
} from "../types/api";

export const albumsApi = {
  list: async (params?: PaginationParams): Promise<PaginatedAlbumResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.cursor) query.append("cursor", params.cursor);

    const res = await apiClient.get<{ albums: PaginatedAlbumResponse }>(
      `/v1/albums?${query.toString()}`,
    );
    return res.albums;
  },

  create: async (data: {
    name: string;
    description?: string;
  }): Promise<AlbumResponse> => {
    const res = await apiClient.post<{ album: AlbumResponse }>(
      "/v1/albums",
      data,
    );
    return res.album;
  },

  get: async (id: string): Promise<AlbumResponse> => {
    const res = await apiClient.get<{ album: AlbumResponse }>(
      `/v1/albums/${id}`,
    );
    return res.album;
  },

  update: async (
    id: string,
    data: { name?: string; description?: string },
  ): Promise<AlbumResponse> => {
    const res = await apiClient.patch<{ album: AlbumResponse }>(
      `/v1/albums/${id}`,
      data,
    );
    return res.album;
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/v1/albums/${id}`);
  },

  listItems: async (
    albumId: string,
    params?: PaginationParams,
  ): Promise<PaginatedAlbumItemsResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.cursor) query.append("cursor", params.cursor);

    const res = await apiClient.get<{ items: PaginatedAlbumItemsResponse }>(
      `/v1/albums/${albumId}/items?${query.toString()}`,
    );
    return res.items;
  },

  addItems: async (albumId: string, mediaIds: string[]): Promise<void> => {
    return apiClient.post(`/v1/albums/${albumId}/items`, { mediaIds });
  },

  removeItem: async (albumId: string, mediaId: string): Promise<void> => {
    return apiClient.delete(`/v1/albums/${albumId}/items/${mediaId}`);
  },
};
