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
      note?: string | null;
    },
  ) {
    return tx.contactMemory.create({
      data: {
        relationshipId: data.relationshipId,
        metAt: data.metAt,
        sourceLabel: data.sourceLabel ?? null,
        note: data.note ?? null,
      },
      select: {
        id: true,
      },
    });
  }

  async updateNote(
    tx: Prisma.TransactionClient,
    data: {
      memoryId?: string;
      relationshipId?: string;
      metAt: Date;
      sourceLabel?: string | null;
      note: string | null;
    },
  ) {
    if (data.memoryId) {
      await tx.contactMemory.update({
        where: {
          id: data.memoryId,
        },
        data: {
          note: data.note,
        },
      });

      return {
        note: data.note,
      };
    }

    await tx.contactMemory.create({
      data: {
        relationshipId: data.relationshipId!,
        metAt: data.metAt,
        sourceLabel: data.sourceLabel ?? null,
        note: data.note,
      },
    });

    return {
      note: data.note,
    };
  }
}
