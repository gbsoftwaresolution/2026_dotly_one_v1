import { getOrCreateConversation } from "@/lib/api/connections";
import { ConnectionType, RelationshipType } from "@/types/connection";
import {
  ConversationType,
  type IdentityConversationContext,
} from "@/types/conversation";

function chooseConversationType(input: {
  connectionType: ConnectionType;
  relationshipType: RelationshipType;
}): ConversationType {
  if (
    input.connectionType === ConnectionType.Client ||
    input.connectionType === ConnectionType.Vendor ||
    input.connectionType === ConnectionType.VerifiedBusiness ||
    input.connectionType === ConnectionType.AdminManaged
  ) {
    return ConversationType.BusinessDirect;
  }

  if (
    input.connectionType === ConnectionType.InnerCircle ||
    input.connectionType === ConnectionType.Family ||
    input.connectionType === ConnectionType.Partner ||
    input.relationshipType === RelationshipType.FamilyMember ||
    input.relationshipType === RelationshipType.Partner ||
    input.relationshipType === RelationshipType.InnerCircle
  ) {
    return ConversationType.ProtectedDirect;
  }

  return ConversationType.Direct;
}

export async function getOrCreateConversationForConnection(input: {
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  createdByIdentityId: string;
  connectionType: ConnectionType;
  relationshipType: RelationshipType;
}): Promise<IdentityConversationContext> {
  return getOrCreateConversation({
    sourceIdentityId: input.sourceIdentityId,
    targetIdentityId: input.targetIdentityId,
    connectionId: input.connectionId,
    conversationType: chooseConversationType({
      connectionType: input.connectionType,
      relationshipType: input.relationshipType,
    }),
    createdByIdentityId: input.createdByIdentityId,
  });
}
