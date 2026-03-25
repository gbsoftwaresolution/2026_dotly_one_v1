import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReleasePoliciesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: any) {
    return this.prisma.releasePolicy.create({
      data: {
        ownerId: userId,
        type: data.type,
        parameters: data.parameters,
        cooldownPeriod: data.cooldownPeriod,
        gracePeriod: data.gracePeriod
      }
    });
  }

  async findAll(userId: string) {
    return this.prisma.releasePolicy.findMany({
      where: { ownerId: userId }
    });
  }

  async findOne(userId: string, id: string) {
    const policy = await this.prisma.releasePolicy.findUnique({
      where: { id }
    });

    if (!policy || policy.ownerId !== userId) {
      throw new NotFoundException("Policy not found");
    }

    return policy;
  }

  async update(userId: string, id: string, data: any) {
      await this.findOne(userId, id); // check ownership

      return this.prisma.releasePolicy.update({
          where: { id },
          data: {
            parameters: data.parameters,
            cooldownPeriod: data.cooldownPeriod,
            gracePeriod: data.gracePeriod
          }
      });
  }

  async remove(userId: string, id: string) {
      await this.findOne(userId, id);
      return this.prisma.releasePolicy.delete({ where: { id } });
  }

  async checkIn(userId: string, id: string) {
      const policy = await this.findOne(userId, id);
      
      // Update check-in timestamp in parameters
      const params = policy.parameters as any || {};
      params.lastCheckIn = new Date().toISOString();
      
      const updated = await this.prisma.releasePolicy.update({
          where: { id },
          data: { parameters: params }
      });

      await this.prisma.auditEvent.create({
          data: {
              userId,
              eventType: "CONTINUITY_CHECK_IN",
              entityType: "ReleasePolicy",
              entityId: id,
              meta: { method: "MANUAL" }
          }
      });
      
      return updated;
  }
}
