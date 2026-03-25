import { apiClient } from "./client";
import { ApiError } from "./client";
import type {
  CreateShareResponse,
  CreateShareStubResponse,
  SharedAlbumMetadataResponse,
  EncryptedShareBundleResponse,
  UnlockShareDto,
  CreateShareRequestDto,
  CreateShareStubRequestDto,
  UploadShareBundleDto,
  SharedMediaDownloadUrlResponse,
  SharedMediaMetadataListResponse,
  ShareAnalyticsResponse,
} from "@booster-vault/shared";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const retryAfterMsFromError = (err: unknown): number | null => {
  // ApiClient doesn't currently expose response headers. Prefer a conservative backoff.
  void err;
  return null;
};

export const sharingApi = {
  /**
   * Create a share for an album
   */
  create: async (
    albumId: string,
    data: CreateShareRequestDto,
  ): Promise<CreateShareResponse> => {
    const res = await apiClient.post<{ share: CreateShareResponse }>(
      `/v1/share/albums/${albumId}`,
      data,
    );
    return res.share;
  },

  /**
   * Create a share stub for an album (owner only)
   */
  createStub: async (
    albumId: string,
    data: CreateShareStubRequestDto,
  ): Promise<CreateShareStubResponse> => {
    const res = await apiClient.post<{ share: CreateShareStubResponse }>(
      `/v1/share/albums/${albumId}/stub`,
      data,
    );
    return res.share;
  },

  /**
   * Upload encrypted bundle for an existing share (owner only)
   */
  uploadBundle: async (
    shareId: string,
    data: UploadShareBundleDto,
  ): Promise<void> => {
    return apiClient.post(`/v1/share/${shareId}/bundle`, data);
  },

  /**
   * Get share metadata (public endpoint)
   */
  getMetadata: async (
    shareId: string,
  ): Promise<SharedAlbumMetadataResponse> => {
    const res = await apiClient.get<{ share: SharedAlbumMetadataResponse }>(
      `/v1/share/${shareId}`,
    );
    return res.share;
  },

  /**
   * Unlock share with passphrase (public endpoint)
   */
  unlock: async (
    shareId: string,
    data: UnlockShareDto,
  ): Promise<EncryptedShareBundleResponse> => {
    const res = await apiClient.post<{ bundle: EncryptedShareBundleResponse }>(
      `/v1/share/${shareId}/unlock`,
      data,
    );
    return res.bundle;
  },

  /**
   * Revoke a share (owner only)
   */
  revoke: async (shareId: string): Promise<void> => {
    return apiClient.post(`/v1/share/${shareId}/revoke`);
  },

  /**
   * List user's active shares
   */
  listActive: async (): Promise<
    Array<{
      id: string;
      album: {
        id: string;
        name: string;
        description?: string;
        coverMediaId?: string;
      };
      expiresAt: Date;
      createdAt: Date;
      viewCount?: number;
      lastViewedAt?: Date;
    }>
  > => {
    const response = await apiClient.get<{ shares: any[] }>(
      "/v1/share/albums/active",
    );
    return response.shares;
  },

  /**
   * Get signed download URL for shared media (requires X-Share-Token header)
   */
  getSharedMediaDownloadUrl: async (
    shareId: string,
    mediaId: string,
    shareToken: string,
    variant?: "original" | "thumb",
  ): Promise<SharedMediaDownloadUrlResponse> => {
    const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
    const attempt = async () => {
      const response = await apiClient.post<{
        downloadUrl: SharedMediaDownloadUrlResponse;
      }>(
        `/v1/share/${shareId}/media/${mediaId}/download-url${query}`,
        undefined,
        {
          headers: {
            "X-Share-Token": shareToken,
          },
        },
      );
      return response.downloadUrl;
    };

    // Burst-prone endpoint: retry a few times on 429.
    const maxAttempts = 4;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await attempt();
      } catch (err) {
        const is429 = err instanceof ApiError && err.status === 429;
        if (!is429 || i === maxAttempts - 1) throw err;

        const retryAfter = retryAfterMsFromError(err);
        const base = retryAfter ?? 250 * Math.pow(2, i);
        const jitter = Math.floor(Math.random() * 150);
        await sleep(base + jitter);
      }
    }

    // Unreachable (loop either returns or throws)
    throw new Error("Failed to get shared media download URL");
  },

  /**
   * List shared media metadata (requires X-Share-Token header)
   */
  listSharedMediaMetadata: async (
    shareId: string,
    shareToken: string,
    options?: { cursor?: number; limit?: number },
  ): Promise<SharedMediaMetadataListResponse> => {
    const params = new URLSearchParams();
    if (options?.cursor != null) params.set("cursor", String(options.cursor));
    if (options?.limit != null) params.set("limit", String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : "";

    const response = await apiClient.get<{
      media: SharedMediaMetadataListResponse;
    }>(`/v1/share/${shareId}/media${query}`, {
      headers: {
        "X-Share-Token": shareToken,
      },
    });
    return response.media;
  },

  /**
   * Track a successful share view (requires X-Share-Token header)
   */
  trackView: async (shareId: string, shareToken: string): Promise<void> => {
    await apiClient.post<void>(`/v1/share/${shareId}/view`, undefined, {
      headers: {
        "X-Share-Token": shareToken,
      },
    });
  },

  /**
   * Get share analytics (owner only)
   */
  getAnalytics: async (shareId: string): Promise<ShareAnalyticsResponse> => {
    const response = await apiClient.get<{ analytics: ShareAnalyticsResponse }>(
      `/v1/share/${shareId}/analytics`,
    );
    return response.analytics;
  },
};
