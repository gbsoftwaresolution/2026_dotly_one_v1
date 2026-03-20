import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class ContactMemoryService {
  async createInitialMemory(
    tx: Prisma.TransactionClient,
    data: {
      relationshipId: string;
      metAt: Date;
      sourceLabel?: string | null;
    },
  ) {
    return tx.contactMemory.create({
      data: {
        relationshipId: data.relationshipId,
        metAt: data.metAt,
        sourceLabel: data.sourceLabel ?? null,
      },
      select: {
        id: true,
      },
    });
  }
}
