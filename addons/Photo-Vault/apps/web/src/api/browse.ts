import { apiClient } from "./client";
import type { BrowsePaginatedMediaResponse } from "@booster-vault/shared";

export interface TimelineQueryParams {
  year?: number;
  albumId?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchQueryParams {
  q: string;
  from?: Date;
  to?: Date;
  albumId?: string;
  limit?: number;
  cursor?: string;
}

export const browseApi = {
  timeline: async (
    params: TimelineQueryParams = {},
  ): Promise<BrowsePaginatedMediaResponse> => {
    const query = new URLSearchParams();
    if (params.year !== undefined) query.append("year", params.year.toString());
    if (params.albumId) query.append("albumId", params.albumId);
    if (params.limit) query.append("limit", params.limit.toString());
    if (params.cursor) query.append("cursor", params.cursor);

    const res = await apiClient.get<{ timeline: BrowsePaginatedMediaResponse }>(
      `/v1/timeline?${query.toString()}`,
    );
    return res.timeline;
  },

  search: async (
    params: SearchQueryParams,
  ): Promise<BrowsePaginatedMediaResponse> => {
    const query = new URLSearchParams();
    query.append("q", params.q);
    if (params.from) query.append("from", params.from.toISOString());
    if (params.to) query.append("to", params.to.toISOString());
    if (params.albumId) query.append("albumId", params.albumId);
    if (params.limit) query.append("limit", params.limit.toString());
    if (params.cursor) query.append("cursor", params.cursor);

    const res = await apiClient.get<{ search: BrowsePaginatedMediaResponse }>(
      `/v1/search?${query.toString()}`,
    );
    return res.search;
  },
};
