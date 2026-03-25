import { apiClient } from "./client";
import type {
  PaginatedMediaResponse,
  MediaResponse,
  PaginationParams,
} from "../types/api";
import type { VaultEncMeta } from "@booster-vault/shared";
import type {
  UploadIntentResponse,
  SignedDownloadUrlResponse,
  MultipartUploadSupport,
  MultipartUploadInitResponse,
  MultipartUploadPartUrlResponse,
  MultipartUploadStatusResponse,
  MultipartCompleteRequest,
} from "@booster-vault/shared";

export interface CreateUploadIntentRequest {
  type: "PHOTO" | "VIDEO" | "DOCUMENT";
  byteSize: number;
  contentType: string;
  originalFilename?: string;
  encAlgo: string;
  encMeta: VaultEncMeta;
  thumbnail?: {
    byteSize: number;
    contentType: string;
    encMeta: VaultEncMeta;
  };
  takenAt?: Date;
  title?: string;
}

export interface CompleteUploadRequest {
  etag?: string;
  sha256CiphertextB64?: string;
  encMeta?: VaultEncMeta;
}

export const mediaApi = {
  getMultipartSupport: async (): Promise<MultipartUploadSupport> => {
    const res = await apiClient.get<{ multipart: MultipartUploadSupport }>(
      "/v1/media/multipart/support",
    );
    return res.multipart;
  },

  list: async (
    params?: PaginationParams,
    includeTrashed?: boolean,
  ): Promise<PaginatedMediaResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.cursor) query.append("cursor", params.cursor);
    if (includeTrashed) query.append("includeTrashed", "true");

    const res = await apiClient.get<{ media: PaginatedMediaResponse }>(
      `/v1/media?${query.toString()}`,
    );
    return res.media;
  },

  get: async (id: string): Promise<MediaResponse> => {
    const res = await apiClient.get<{ media: MediaResponse }>(
      `/v1/media/${id}`,
    );
    return res.media;
  },

  update: async (
    id: string,
    data: Partial<{
      title?: string;
      note?: string;
      locationText?: string;
    }>,
  ): Promise<MediaResponse> => {
    const res = await apiClient.patch<{ media: MediaResponse }>(
      `/v1/media/${id}`,
      data,
    );
    return res.media;
  },

  trash: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/media/${id}`);
  },

  restore: async (id: string): Promise<void> => {
    await apiClient.post(`/v1/media/${id}/restore`);
  },

  purge: async (id: string): Promise<void> => {
    await apiClient.post(`/v1/media/${id}/purge`);
  },

  // Backward-compatible alias (older code used `delete()` to mean purge)
  delete: async (id: string): Promise<void> => {
    await apiClient.post(`/v1/media/${id}/purge`);
  },

  // Upload workflows
  createUploadIntent: async (
    data: CreateUploadIntentRequest,
  ): Promise<UploadIntentResponse> => {
    return apiClient.post<UploadIntentResponse>(
      "/v1/media/upload-intents",
      data,
    );
  },

  completeUpload: async (
    mediaId: string,
    data: CompleteUploadRequest,
  ): Promise<void> => {
    return apiClient.post(`/v1/media/${mediaId}/complete-upload`, data);
  },

  completeThumbnailUpload: async (
    mediaId: string,
    data: CompleteUploadRequest,
  ): Promise<void> => {
    return apiClient.post(
      `/v1/media/${mediaId}/complete-thumbnail-upload`,
      data,
    );
  },

  createThumbnailUploadIntent: async (
    mediaId: string,
    data: {
      byteSize: number;
      contentType: string;
      encMeta: VaultEncMeta;
    },
  ): Promise<{
    media: MediaResponse;
    signedThumbnailUploadUrl: {
      url: string;
      headers: Record<string, string>;
      expiresAt: Date;
      method: "PUT";
    };
  }> => {
    return apiClient.post(`/v1/media/${mediaId}/thumbnail-upload-intent`, data);
  },

  // Multipart upload workflows (S3/Spaces/MinIO)
  initMultipartUpload: async (
    mediaId: string,
  ): Promise<MultipartUploadInitResponse> => {
    const res = await apiClient.post<{
      multipart: MultipartUploadInitResponse;
    }>(`/v1/media/${mediaId}/multipart/init`, {});
    return res.multipart;
  },

  getMultipartPartUrl: async (args: {
    mediaId: string;
    uploadId: string;
    partNumber: number;
  }): Promise<MultipartUploadPartUrlResponse> => {
    const query = new URLSearchParams({
      uploadId: args.uploadId,
      partNumber: String(args.partNumber),
    });
    const res = await apiClient.post<{ part: MultipartUploadPartUrlResponse }>(
      `/v1/media/${args.mediaId}/multipart/part-url?${query.toString()}`,
      {},
    );
    return res.part;
  },

  getMultipartStatus: async (args: {
    mediaId: string;
    uploadId: string;
  }): Promise<MultipartUploadStatusResponse> => {
    const query = new URLSearchParams({ uploadId: args.uploadId });
    const res = await apiClient.get<{ status: MultipartUploadStatusResponse }>(
      `/v1/media/${args.mediaId}/multipart/status?${query.toString()}`,
    );
    return res.status;
  },

  completeMultipartUpload: async (args: {
    mediaId: string;
    uploadId: string;
    body: MultipartCompleteRequest;
  }): Promise<{ etag?: string }> => {
    const query = new URLSearchParams({ uploadId: args.uploadId });
    const res = await apiClient.post<{ result: { etag?: string } }>(
      `/v1/media/${args.mediaId}/multipart/complete?${query.toString()}`,
      args.body,
    );
    return res.result;
  },

  abortMultipartUpload: async (args: {
    mediaId: string;
    uploadId: string;
  }): Promise<void> => {
    const query = new URLSearchParams({ uploadId: args.uploadId });
    await apiClient.post(
      `/v1/media/${args.mediaId}/multipart/abort?${query.toString()}`,
      {},
    );
  },

  getDownloadUrl: async (
    mediaId: string,
    variant?: "original" | "thumb",
  ): Promise<SignedDownloadUrlResponse> => {
    const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
    const res = await apiClient.post<{
      downloadUrl: SignedDownloadUrlResponse;
    }>(`/v1/media/${mediaId}/download-url${query}`, {});
    return res.downloadUrl;
  },
};
