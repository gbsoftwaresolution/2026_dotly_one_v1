import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectionsApi } from "./connections";
import { apiRequest } from "@/lib/api/client";
import { PermissionEffect } from "@/types/connection";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

describe("connectionsApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("listPermissionOverrides", () => {
    it("fetches and normalizes override records", async () => {
      const mockBackendResponse = [
        {
          permissionKey: "msg.text.send",
          effect: "allow",
          limits: { maxPerDay: 50 },
          reason: "User manually allowed",
          createdAt: "2026-03-26T12:00:00Z",
          createdByIdentityId: "id-123",
        },
      ];

      vi.mocked(apiRequest).mockResolvedValueOnce(mockBackendResponse);

      const result = await connectionsApi.listPermissionOverrides("conn-1");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permission-overrides"
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        key: "msg.text.send",
        effect: "allow",
        limitsJson: { maxPerDay: 50 },
        reason: "User manually allowed",
        createdAt: "2026-03-26T12:00:00Z",
      });
    });
  });

  describe("updatePermissionOverride", () => {
    it("sends PUT request and normalizes the response", async () => {
      const mockBackendResponse = {
        permissionKey: "media.image.send",
        effect: "deny",
        limitsJson: null,
        reason: "Spammy",
        createdAt: "2026-03-26T12:05:00Z",
      };

      vi.mocked(apiRequest).mockResolvedValueOnce(mockBackendResponse);

      const result = await connectionsApi.updatePermissionOverride(
        "conn-1",
        "media.image.send",
        PermissionEffect.Deny,
        undefined,
        "Spammy"
      );

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permission-overrides/media.image.send",
        {
          method: "PUT",
          body: { effect: "deny", limitsJson: undefined, reason: "Spammy" },
        }
      );
      expect(result).toEqual({
        key: "media.image.send",
        effect: "deny",
        limitsJson: null,
        reason: "Spammy",
        createdAt: "2026-03-26T12:05:00Z",
      });
    });
  });

  describe("explainPermission", () => {
    it("fetches explanation and normalizes to UI-friendly model", async () => {
      const mockBackendResponse = {
        permissionKey: "msg.group.invite",
        finalEffect: "request_approval",
        finalReasonCode: "relationship_rule",
        stages: [
          { stage: "template", label: "Base policy", applied: false },
          { stage: "relationship", label: "Friend policy", applied: true },
        ],
      };

      vi.mocked(apiRequest).mockResolvedValueOnce(mockBackendResponse);

      const result = await connectionsApi.explainPermission("conn-1", "msg.group.invite");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permissions/msg.group.invite/explain"
      );
      expect(result).toEqual({
        key: "msg.group.invite",
        finalEffect: "request_approval",
        reason: "relationship_rule",
        trace: ["Friend policy (relationship)"],
      });
    });

    it("provides fallback reason if finalReasonCode is missing", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        permissionKey: "call.voice.initiate",
        finalEffect: "allow",
        stages: [],
      });

      const result = await connectionsApi.explainPermission("conn-1", "call.voice.initiate");
      expect(result.reason).toBe("Derived from standard connection policies.");
      expect(result.trace).toEqual([]);
    });
  });

  describe("refreshResolvedPermissions", () => {
    it("calls endpoint with forceRefresh=true", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({ permissions: {} });

      await connectionsApi.refreshResolvedPermissions("conn-1");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/resolved-permissions?forceRefresh=true"
      );
    });
  });
});
