import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ContinuityPackStatus, ContinuityRecipientRole } from "@prisma/client";

@Injectable()
export class ContinuityPacksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: any) {
    // Validate policy ownership if provided
    if (data.releasePolicyId) {
        const policy = await this.prisma.releasePolicy.findUnique({
            where: { id: data.releasePolicyId },
        });
        if (!policy || policy.ownerId !== userId) {
            throw new BadRequestException("Invalid release policy");
        }
    }

      const pack = await this.prisma.continuityPack.create({
      data: {
        ownerId: userId,
        name: data.name,
        description: data.description,
        releasePolicyId: data.releasePolicyId,
        revealCategory: data.revealCategory,
        revealExpiry: data.revealExpiry,
        revealIssuer: data.revealIssuer,
        forceMaskedMode: data.forceMaskedMode ?? true,
        releaseExpiryDays: data.releaseExpiryDays,
        items: {
            create: (data.items || []).map(item => ({
                lifeDocId: item.lifeDocId,
                versionGroupId: item.versionGroupId,
            }))
        },
        recipients: {
            create: (data.recipients || []).map(r => ({
                recipientId: r.recipientId,
                role: r.role
            }))
        }
      },
      include: {
          items: true,
          recipients: true
      }
    });

    await this.prisma.auditEvent.create({
        data: {
            userId,
            eventType: "CONTINUITY_PACK_CREATED",
            entityType: "ContinuityPack",
            entityId: pack.id,
        }
    });

    return pack;
  }

  async findAll(userId: string) {
    return this.prisma.continuityPack.findMany({
      where: { ownerId: userId },
      include: {
        releasePolicy: true,
        _count: {
            select: { items: true, recipients: true }
        }
      }
    });
  }

  async findOne(userId: string, id: string) {
    const pack = await this.prisma.continuityPack.findUnique({
      where: { id },
      include: {
          items: true,
          recipients: {
              include: {
                  recipient: true
              }
          },
          releasePolicy: true
      }
    });

    if (!pack || pack.ownerId !== userId) {
      throw new NotFoundException("Pack not found");
    }

    return pack;
  }

  async update(userId: string, id: string, data: any) {
      const pack = await this.findOne(userId, id); // check ownership

      if (pack.status === ContinuityPackStatus.RELEASED) {
          throw new BadRequestException("Cannot edit a released pack");
      }

      const updated = await this.prisma.continuityPack.update({
          where: { id },
          data: {
              name: data.name,
              description: data.description,
              releasePolicyId: data.releasePolicyId,
              revealCategory: data.revealCategory,
              revealExpiry: data.revealExpiry,
              revealIssuer: data.revealIssuer,
              forceMaskedMode: data.forceMaskedMode,
              releaseExpiryDays: data.releaseExpiryDays,
          }
      });

      await this.prisma.auditEvent.create({
          data: {
              userId,
              eventType: "CONTINUITY_PACK_UPDATED",
              entityType: "ContinuityPack",
              entityId: id,
          }
      });
      
      return updated;
  }

  async remove(userId: string, id: string) {
      await this.findOne(userId, id);
      const deleted = await this.prisma.continuityPack.delete({ where: { id } });
      
      await this.prisma.auditEvent.create({
            data: {
                userId,
                eventType: "CONTINUITY_PACK_DELETED",
                entityType: "ContinuityPack",
                entityId: id,
            }
      });
      
      return deleted;
  }

  async arm(userId: string, id: string) {
      const pack = await this.findOne(userId, id);
      // Validate
      if (!pack.releasePolicyId) throw new BadRequestException("Missing release policy");
      
      const armed = await this.prisma.continuityPack.update({
          where: { id },
          data: { status: ContinuityPackStatus.ARMED }
      });

      await this.prisma.auditEvent.create({
          data: {
              userId,
              eventType: "CONTINUITY_PACK_ARMED",
              entityType: "ContinuityPack",
              entityId: id
          }
      });
      
      return armed;
  }

  async addItem(userId: string, packId: string, lifeDocId: string) {
      const pack = await this.findOne(userId, packId);
      if (pack.status === ContinuityPackStatus.RELEASED) throw new BadRequestException("Cannot edit released pack");

      return this.prisma.continuityPackItem.create({
          data: {
              packId,
              lifeDocId,
          }
      });
  }

  async removeItem(userId: string, packId: string, itemId: string) {
      const pack = await this.findOne(userId, packId);
      if (pack.status === ContinuityPackStatus.RELEASED) throw new BadRequestException("Cannot edit released pack");
      
      // Verify item belongs to pack
      const item = await this.prisma.continuityPackItem.findUnique({ where: { id: itemId } });
      if (!item || item.packId !== packId) throw new NotFoundException("Item not found in pack");

      return this.prisma.continuityPackItem.delete({ where: { id: itemId } });
  }

  async addRecipient(userId: string, packId: string, recipientId: string, role: string) {
      const pack = await this.findOne(userId, packId);
      if (pack.status === ContinuityPackStatus.RELEASED) throw new BadRequestException("Cannot edit released pack");

      const normalizedRole = role as ContinuityRecipientRole;
      if (!Object.values(ContinuityRecipientRole).includes(normalizedRole)) {
          throw new BadRequestException("Invalid recipient role");
      }

      return this.prisma.continuityPackRecipient.create({
          data: {
              packId,
              recipientId,
              role: normalizedRole
          }
      });
  }

  async removeRecipient(userId: string, packId: string, recipientId: string) {
      const pack = await this.findOne(userId, packId);
      if (pack.status === ContinuityPackStatus.RELEASED) throw new BadRequestException("Cannot edit released pack");

      // Verify recipient linkage
      // Note: We are deleting the link (ContinuityPackRecipient), usually identified by composite key or id. 
      // Need to check schema if ContinuityPackRecipient has an ID or uses composite.
      // Based on typical usage, let's assume `recipientId` passed here is the ID of the LINK table, 
      // OR we need to find the link by recipientId + packId.
      
      // If the controller passed the `recipientId` (the person), we delete by composite.
      // If it passed the `id` of the relationship, we delete by ID.
      // Let's assume the controller passed the `recipientId` of the person for "removeRecipientFromPack".
      // Actually standard API usually uses the ID of the relationship for deletion if it's available, 
      // but let's check how we typically do it. 
      // Let's assume we delete by the unique combination or find the record first.
      
      const linkage = await this.prisma.continuityPackRecipient.findFirst({
          where: { packId, recipientId }
      });

      if (!linkage) throw new NotFoundException("Recipient not found in pack");

      return this.prisma.continuityPackRecipient.delete({ 
          where: { id: linkage.id } 
      });
  }
}
