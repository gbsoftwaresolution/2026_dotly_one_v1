import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ContinuityReleasesService } from "./releases/continuity-releases.service";
import { ReleasePolicyType, ContinuityPackStatus } from "@prisma/client";

@Injectable()
export class ContinuitySchedulerService {
  private readonly logger = new Logger(ContinuitySchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private releasesService: ContinuityReleasesService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleInactivityChecks() {
    this.logger.log("Running Inactivity Checks...");

    // Find all INACTIVITY policies
    // This could be optimized to database query filtering, but parameters is JSON
    // So we might need to fetch all active ones or use raw query if scale needed.
    // For prototype, fetching all is fine or fetch by type.
    
    const policies = await this.prisma.releasePolicy.findMany({
        where: { type: ReleasePolicyType.INACTIVITY },
        include: { packs: true }
    });

    const now = new Date();

    for (const policy of policies) {
        try {
            const params = policy.parameters as any;
            const days = params.inactivityDays || 30;
            const lastCheckInStr = params.lastCheckIn || policy.updatedAt.toISOString();
            const lastCheckIn = new Date(lastCheckInStr);
            
            const diffTime = Math.abs(now.getTime() - lastCheckIn.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays > days) {
                // Trigger condition met
                this.logger.warn(`Policy ${policy.id} triggered: ${diffDays} days inactive (limit ${days})`);
                
                // Check related packs
                for (const pack of policy.packs) {
                    if (pack.status === ContinuityPackStatus.ARMED) {
                        this.logger.log(`Executing release for pack ${pack.id} due to inactivity`);
                        await this.releasesService.executeRelease(policy.ownerId, pack.id);
                        
                        // Log extra context
                        await this.prisma.auditEvent.create({
                            data: {
                                userId: policy.ownerId,
                                eventType: "CONTINUITY_TRIGGER_FIRED",
                                entityType: "ReleasePolicy",
                                entityId: policy.id,
                                meta: { reason: "INACTIVITY_LIMIT_REACHED", inactiveDays: diffDays }
                            }
                        });
                    }
                }
            }
        } catch (e) {
            this.logger.error(`Error processing policy ${policy.id}: ${e.message}`);
        }
    }
  }
}
