import { MediaResponse } from '../media/media.types';

export interface TimelineQueryDto {
  year?: number;
  albumId?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchQueryDto {
  q: string;
  from?: Date;
  to?: Date;
  albumId?: string;
  limit?: number;
  cursor?: string;
}

export interface BrowsePaginatedMediaResponse {
  items: MediaResponse[];
  pagination: {
    limit: number;
    cursor?: string;
    nextCursor?: string;
  };
}

export type { MediaResponse };
