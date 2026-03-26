import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOrCreateConversationForConnection } from "./conversation-routing";
import { ConnectionType, RelationshipType } from "../types/connection";

const mocks = vi.hoisted(() => ({
  getOrCreateConversation: vi.fn(),
}));

vi.mock("@/lib/api/connections", () => ({
  getOrCreateConversation: mocks.getOrCreateConversation,
}));

describe("getOrCreateConversationForConnection", () => {
  beforeEach(() => {
    mocks.getOrCreateConversation.mockReset();
  });

  it("posts a get-or-create request for the connection", async () => {
    mocks.getOrCreateConversation.mockResolvedValue({
      conversationId: "conversation-1",
    });

    const result = await getOrCreateConversationForConnection({
      connectionId: "connection-1",
      sourceIdentityId: "source-1",
      targetIdentityId: "target-1",
      createdByIdentityId: "source-1",
      connectionType: ConnectionType.Trusted,
      relationshipType: RelationshipType.Friend,
    });

    expect(result.conversationId).toBe("conversation-1");
    expect(mocks.getOrCreateConversation).toHaveBeenCalledWith({
      sourceIdentityId: "source-1",
      targetIdentityId: "target-1",
      connectionId: "connection-1",
      conversationType: "DIRECT",
      createdByIdentityId: "source-1",
    });
  });

  it("uses protected direct when the relationship suggests it", async () => {
    mocks.getOrCreateConversation.mockResolvedValue({
      conversationId: "conversation-2",
    });

    await getOrCreateConversationForConnection({
      connectionId: "connection-2",
      sourceIdentityId: "source-1",
      targetIdentityId: "target-2",
      createdByIdentityId: "source-1",
      connectionType: ConnectionType.Partner,
      relationshipType: RelationshipType.Partner,
    });

    expect(mocks.getOrCreateConversation).toHaveBeenCalledWith({
      sourceIdentityId: "source-1",
      targetIdentityId: "target-2",
      connectionId: "connection-2",
      conversationType: "PROTECTED_DIRECT",
      createdByIdentityId: "source-1",
    });
  });
});
