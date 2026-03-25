import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ContinuityRecipientsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: any) {
    return this.prisma.continuityRecipient.create({
      data: {
        ownerId: userId,
        email: data.email,
        name: data.name,
        phone: data.phone
      }
    });
  }

  async findAll(userId: string) {
    return this.prisma.continuityRecipient.findMany({
      where: { ownerId: userId }
    });
  }

  async remove(userId: string, id: string) {
      const recipient = await this.prisma.continuityRecipient.findUnique({
          where: { id }
      });
      
      if (!recipient || recipient.ownerId !== userId) {
          throw new NotFoundException("Recipient not found");
      }
      
      return this.prisma.continuityRecipient.delete({ where: { id } });
  }
}
