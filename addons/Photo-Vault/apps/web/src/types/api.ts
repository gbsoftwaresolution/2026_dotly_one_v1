import type {
  MediaResponse,
  PaginatedMediaResponse,
  MediaType,
  AlbumResponse,
  PaginatedAlbumResponse,
  AlbumItemResponse,
  PaginatedAlbumItemsResponse,
  ExportResponse,
  ExportScopeType,
  ExportStatus,
  PaginatedExportsResponse,
  BillingPlan,
  CryptoInvoiceResponse,
  CryptoInvoiceStatusResponse,
  StripeCheckoutSessionResponse,
} from "@booster-vault/shared";

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, any>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName?: string;
  locale: string;
  timezone: string;
  emailVerified: boolean;
  trialEndsAt?: string;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  currentPlanCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

// Re-export shared types for convenience
export type {
  MediaResponse,
  PaginatedMediaResponse,
  MediaType,
  AlbumResponse,
  PaginatedAlbumResponse,
  AlbumItemResponse,
  PaginatedAlbumItemsResponse,
  ExportResponse,
  ExportScopeType,
  ExportStatus,
  PaginatedExportsResponse,
  BillingPlan,
  CryptoInvoiceResponse,
  CryptoInvoiceStatusResponse,
  StripeCheckoutSessionResponse,
};
