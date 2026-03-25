import { MediaResponse } from '../media/media.types';

export interface AlbumResponse {
  id: string;
  name: string;
  description?: string;
  coverMediaId?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumItemResponse {
  media: MediaResponse;
  position: number;
  addedAt: Date;
}

export interface PaginatedAlbumResponse {
  items: AlbumResponse[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface PaginatedAlbumItemsResponse {
  items: AlbumItemResponse[];
  nextCursor?: string;
  hasMore: boolean;
}
