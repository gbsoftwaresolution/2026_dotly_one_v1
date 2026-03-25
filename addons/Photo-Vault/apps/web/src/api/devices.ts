import { apiClient } from "./client";
import type {
  DevicesListResponse,
  RenameDeviceDto,
  RevokeDeviceResponse,
} from "@booster-vault/shared";

export const devicesApi = {
  /**
   * Get list of active devices/sessions for the current user
   */
  async getDevices(): Promise<DevicesListResponse> {
    return apiClient.get("/v1/devices");
  },

  /**
   * Rename a device/session
   */
  async renameDevice(sessionId: string, deviceName: string): Promise<void> {
    const dto: RenameDeviceDto = { deviceName };
    return apiClient.patch(`/v1/devices/${sessionId}`, dto);
  },

  /**
   * Revoke a specific device/session
   */
  async revokeDevice(sessionId: string): Promise<RevokeDeviceResponse> {
    return apiClient.post(`/v1/devices/${sessionId}/revoke`);
  },

  /**
   * Revoke all other devices/sessions except current
   */
  async revokeOtherDevices(): Promise<{ revokedCount: number }> {
    return apiClient.post("/v1/devices/revoke-others");
  },
};
