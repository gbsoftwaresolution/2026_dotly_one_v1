import { apiClient } from "./client";
import type {
  ResetVaultKeyBundleDto,
  UpsertVaultKeyBundleDto,
  VaultKeyBundleStatusResponse,
} from "@booster-vault/shared";

/**
 * API client for vault key bundle operations.
 */

export interface VaultKeyBundle {
  encryptedMasterKey: string;
  iv: string;
  kdfParams: {
    iterations: number;
    hash: string;
    salt: string;
  };
}

export const vaultKeyApi = {
  /**
   * Get vault key bundle status
   */
  async getStatus(): Promise<VaultKeyBundleStatusResponse> {
    const response = await apiClient.get<VaultKeyBundleStatusResponse>(
      "/v1/vault-key/status",
    );
    return response;
  },

  /**
   * Create or update vault key bundle
   */
  async upsert(bundle: UpsertVaultKeyBundleDto): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>(
      "/v1/vault-key/upsert",
      bundle,
    );
    return response;
  },

  /**
   * Get encrypted vault key bundle (used during unlock)
   */
  async getBundle(): Promise<VaultKeyBundle> {
    const response = await apiClient.get<VaultKeyBundle>(
      "/v1/vault-key/bundle",
    );
    return response;
  },

  /**
   * Destructively reset the vault bundle (requires current account password).
   */
  async reset(dto: ResetVaultKeyBundleDto): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>(
      "/v1/vault-key/reset",
      dto,
    );
    return response;
  },
};
