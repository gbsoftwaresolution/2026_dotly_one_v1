import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectionsApi } from "./connections";
import { apiRequest } from "@/lib/api/client";
import { PermissionEffect } from "@/types/connection";
import { ConversationStatus } from "@/types/conversation";

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
        "/identity-connections/conn-1/permission-overrides",
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

  describe("getConversationContext", () => {
    it("fetches and normalizes conversation context", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        conversationId: "conversation-1",
        connectionId: "conn-1",
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        conversationType: "PROTECTED_DIRECT",
        conversationStatus: "ACTIVE",
        title: null,
        metadataJson: null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: "source-1",
        createdAt: "2026-03-26T12:00:00Z",
        updatedAt: "2026-03-26T12:00:00Z",
      });

      const result =
        await connectionsApi.getConversationContext("conversation-1");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-conversations/conversation-1",
      );
      expect(result).toEqual({
        conversationId: "conversation-1",
        connectionId: "conn-1",
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        conversationType: "PROTECTED_DIRECT",
        conversationStatus: "ACTIVE",
        title: null,
        metadataJson: null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: "source-1",
        createdAt: "2026-03-26T12:00:00Z",
        updatedAt: "2026-03-26T12:00:00Z",
      });
    });
  });

  describe("listConversationsForIdentity", () => {
    it("fetches and normalizes conversations for an identity", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce([
        {
          conversationId: "conversation-1",
          connectionId: "conn-1",
          sourceIdentityId: "source-1",
          targetIdentityId: "target-1",
          conversationType: "PROTECTED_DIRECT",
          conversationStatus: "ACTIVE",
          title: null,
          metadataJson: null,
          lastResolvedAt: null,
          lastPermissionHash: null,
          createdByIdentityId: "source-1",
          createdAt: "2026-03-26T12:00:00Z",
          updatedAt: "2026-03-26T12:00:00Z",
        },
      ]);

      const result = await connectionsApi.listConversationsForIdentity(
        "source-1",
        ConversationStatus.Active,
      );

      expect(apiRequest).toHaveBeenCalledWith(
        "/identities/source-1/conversations?status=ACTIVE",
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.conversationId).toBe("conversation-1");
    });
  });

  describe("createConversation", () => {
    it("creates and normalizes a conversation", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        conversationId: "conversation-1",
        connectionId: "conn-1",
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        conversationType: "PROTECTED_DIRECT",
        conversationStatus: "ACTIVE",
        title: null,
        metadataJson: null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: "source-1",
        createdAt: "2026-03-26T12:00:00Z",
        updatedAt: "2026-03-26T12:00:00Z",
      });

      const result = await connectionsApi.createConversation({
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        connectionId: "conn-1",
        conversationType: "PROTECTED_DIRECT" as any,
        createdByIdentityId: "source-1",
      });

      expect(apiRequest).toHaveBeenCalledWith("/identity-conversations", {
        method: "POST",
        body: {
          sourceIdentityId: "source-1",
          targetIdentityId: "target-1",
          connectionId: "conn-1",
          conversationType: "PROTECTED_DIRECT",
          createdByIdentityId: "source-1",
        },
      });
      expect(result.conversationId).toBe("conversation-1");
    });
  });

  describe("getOrCreateConversation", () => {
    it("posts to the get-or-create conversation endpoint", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        conversationId: "conversation-1",
        connectionId: "conn-1",
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        conversationType: "PROTECTED_DIRECT",
        conversationStatus: "ACTIVE",
        title: null,
        metadataJson: null,
        lastResolvedAt: null,
        lastPermissionHash: null,
        createdByIdentityId: "source-1",
        createdAt: "2026-03-26T12:00:00Z",
        updatedAt: "2026-03-26T12:00:00Z",
      });

      const result = await connectionsApi.getOrCreateConversation({
        sourceIdentityId: "source-1",
        targetIdentityId: "target-1",
        connectionId: "conn-1",
        conversationType: "PROTECTED_DIRECT" as any,
        createdByIdentityId: "source-1",
      });

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-conversations/get-or-create",
        {
          method: "POST",
          body: {
            sourceIdentityId: "source-1",
            targetIdentityId: "target-1",
            connectionId: "conn-1",
            conversationType: "PROTECTED_DIRECT",
            createdByIdentityId: "source-1",
          },
        },
      );
      expect(result.conversationId).toBe("conversation-1");
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
        "Spammy",
      );

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permission-overrides/media.image.send",
        {
          method: "PUT",
          body: { effect: "deny", limitsJson: undefined, reason: "Spammy" },
        },
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

      const result = await connectionsApi.explainPermission(
        "conn-1",
        "msg.group.invite",
      );

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permissions/msg.group.invite/explain",
      );
      expect(result).toEqual({
        key: "msg.group.invite",
        finalEffect: "request_approval",
        reason: "relationship_rule",
        reasonCode: "relationship_rule",
        explanationText: null,
        trace: ["Friend policy (relationship)"],
      });
    });

    it("provides fallback reason if finalReasonCode is missing", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        permissionKey: "call.voice.initiate",
        finalEffect: "allow",
        stages: [],
      });

      const result = await connectionsApi.explainPermission(
        "conn-1",
        "call.voice.initiate",
      );
      expect(result.reason).toBe("Derived from standard connection policies.");
      expect(result.reasonCode).toBeNull();
      expect(result.explanationText).toBeNull();
      expect(result.trace).toEqual([]);
    });
  });

  describe("explainResolvedPermissions", () => {
    it("fetches permission summary for protected-mode UX", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        summaryText:
          "Protected permissions are restricted by backend policy resolution.",
        blockedPermissionKeys: ["media.export"],
        protectedPermissionKeys: ["media.export", "call.video.initiate"],
        permissions: [
          {
            permissionKey: "media.export",
            finalEffect: "deny",
            finalReasonCode: "RISK_BLOCKED",
            explanationText:
              "Exports are blocked while safety conditions remain unresolved.",
          },
        ],
      });

      const result = await connectionsApi.explainResolvedPermissions("conn-1");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/permissions/explain?preferCache=true",
      );
      expect(result).toEqual({
        summaryText:
          "Protected permissions are restricted by backend policy resolution.",
        blockedPermissionKeys: ["media.export"],
        protectedPermissionKeys: ["media.export", "call.video.initiate"],
        permissions: [
          {
            key: "media.export",
            finalEffect: "deny",
            reasonCode: "RISK_BLOCKED",
            explanationText:
              "Exports are blocked while safety conditions remain unresolved.",
          },
        ],
      });
    });
  });

  describe("refreshResolvedPermissions", () => {
    it("calls endpoint with forceRefresh=true", async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({ permissions: {} });

      await connectionsApi.refreshResolvedPermissions("conn-1");

      expect(apiRequest).toHaveBeenCalledWith(
        "/identity-connections/conn-1/resolved-permissions?forceRefresh=true",
      );
    });
  });
});
