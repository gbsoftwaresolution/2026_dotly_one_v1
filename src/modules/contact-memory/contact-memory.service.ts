import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class ContactMemoryService {
  async createInitialMemory(
    tx: Prisma.TransactionClient,
    data: {
      relationshipId: string;
      eventId?: string | null;
      contextLabel?: string | null;
      metAt: Date;
      sourceLabel?: string | null;
      note?: string | null;
    },
  ) {
    return tx.contactMemory.create({
      data: {
        relationshipId: data.relationshipId,
        eventId: data.eventId ?? null,
        contextLabel: data.contextLabel ?? data.sourceLabel ?? "",
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
      eventId?: string | null;
      contextLabel?: string | null;
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
        eventId: data.eventId ?? null,
        contextLabel: data.contextLabel ?? data.sourceLabel ?? "",
        metAt: data.metAt,
        sourceLabel: data.sourceLabel ?? null,
        note: data.note,
      },
    });

    return {
      note: data.note,
    };
  }

  async upsertInteractionMemory(
    tx: Prisma.TransactionClient,
    data: {
      relationshipId: string;
      eventId?: string | null;
      contextLabel?: string | null;
      metAt: Date;
      sourceLabel?: string | null;
    },
  ) {
    const existingMemory = await tx.contactMemory.findFirst({
      where: {
        relationshipId: data.relationshipId,
      },
      orderBy: [{ metAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
      },
    });

    if (existingMemory) {
      return tx.contactMemory.update({
        where: {
          id: existingMemory.id,
        },
        data: {
          eventId: data.eventId ?? null,
          contextLabel: data.contextLabel ?? data.sourceLabel ?? "",
          metAt: data.metAt,
          sourceLabel: data.sourceLabel ?? null,
        },
        select: {
          id: true,
        },
      });
    }

    return this.createInitialMemory(tx, data);
  }
}
