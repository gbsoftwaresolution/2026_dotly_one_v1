import { apiClient } from "./client";
import type {
  EnableRecoveryDto,
  DisableRecoveryDto,
  RecoveryStatusResponse,
} from "@booster-vault/shared";

export const recoveryApi = {
  /**
   * Enable recovery phrase for the current user
   */
  async enableRecovery(data: EnableRecoveryDto): Promise<{ success: boolean }> {
    return apiClient.post("/v1/recovery/enable", data);
  },

  /**
   * Get recovery status for the current user
   */
  async getStatus(): Promise<RecoveryStatusResponse> {
    return apiClient.get("/v1/recovery/status");
  },

  /**
   * Disable recovery phrase for the current user
   * Requires password re-authentication
   */
  async disableRecovery(data: DisableRecoveryDto): Promise<void> {
    return apiClient.delete("/v1/recovery/disable", {
      body: JSON.stringify(data),
    });
  },

  /**
   * Get encrypted master key for recovery (used during restore flow)
   * This endpoint is used when a user is trying to restore their vault on a new device
   * It returns the encrypted bundle without any authentication beyond the recovery phrase
   */
  async getRecoveryBundle(
    userId: string,
  ): Promise<{ encryptedMasterKey: string; iv: string; kdfParams: any }> {
    return apiClient.post("/v1/recovery/bundle", { userId });
  },
};
