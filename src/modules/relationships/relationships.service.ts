import { ConflictException, Injectable } from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  Prisma,
} from "@prisma/client";

@Injectable()
export class RelationshipsService {
  async createApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
    },
  ) {
    try {
      return await tx.contactRelationship.create({
        data: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
          state: PrismaContactRelationshipState.APPROVED,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Contact relationship already exists");
      }

      throw error;
    }
  }
}
