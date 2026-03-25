import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "../../config/config.service";
import { MailService } from "../../mail/mail.service";
import { ContinuityPackStatus, ReleaseInstanceStatus } from "@prisma/client";

@Injectable()
export class ContinuityReleasesService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private mailService: MailService
  ) {}

  async executeRelease(userId: string, packId: string) {
    const pack = await this.prisma.continuityPack.findUnique({
        where: { id: packId },
        include: {
            items: true,
                        recipients: {
                            include: {
                                recipient: true,
                            },
                        },
        }
    });

    if (!pack || pack.ownerId !== userId) {
        throw new NotFoundException("Pack not found");
    }

    if (pack.status !== ContinuityPackStatus.ARMED) {
        throw new BadRequestException("Pack must be ARMED before release");
    }

    // Create Release Instances for all recipients
    const snapshot = pack.items.map(item => ({
        lifeDocId: item.lifeDocId,
        versionGroupId: item.versionGroupId,
        // In a real system we would resolve versionGroupId to specific DocID here
    }));

    // Transactional
    const releaseResults = await this.prisma.$transaction(async (tx) => {
        const instances: any[] = [];
        const recipientDetails: Array<{ email: string; name: string; accessKey: string }> = [];

        for (const r of pack.recipients) {
            // MOCK CRYPTO: Generate a release key wrapped for the recipient's public key (if we had it)
            // In real impl: fetch r.recipient.publicKey, encrypt packKey with it.
            const accessKey = "mock_release_key_" + Date.now() + "_" + Math.floor(Math.random() * 1000); 

            const instance = await tx.releaseInstance.create({
                data: {
                    packId: pack.id,
                    recipientId: r.recipientId,
                    releasedAt: new Date(),
                    scopeSnapshot: snapshot as any, // Json
                    status: ReleaseInstanceStatus.RELEASED,
                    key: accessKey
                }
            });
            instances.push(instance);
            recipientDetails.push({
                email: r.recipient.email,
                name: r.recipient.name,
                accessKey
            });
            
            // Log for each recipient release
             await tx.auditEvent.create({
                data: {
                    userId,
                    eventType: "CONTINUITY_RELEASE_INSTANCE_CREATED",
                    entityType: "ReleaseInstance",
                    entityId: instance.id,
                    meta: { recipientId: r.recipientId }
                }
            });
        }

        await tx.continuityPack.update({
            where: { id: pack.id },
            data: { status: ContinuityPackStatus.RELEASED }
        });

        await tx.auditEvent.create({
            data: {
                userId,
                eventType: "CONTINUITY_RELEASE_EXECUTED",
                entityType: "ContinuityPack",
                entityId: pack.id,
                meta: { recipientCount: pack.recipients.length }
            }
        });

        return { instances, recipientDetails };
    });

    // Side effects: Send Emails
    const owner = await this.prisma.user.findUnique({ where: { id: pack.ownerId } });
    const ownerDisplayName = owner ? (owner.displayName || owner.email) : "A user";

    for (const detail of releaseResults.recipientDetails) {
        await this.mailService.sendContinuityReleaseEmail(detail.email, {
            recipientName: detail.name,
            ownerName: ownerDisplayName,
            packName: pack.name,
            accessCode: detail.accessKey,
            portalUrl: `${this.configService.webAppUrl}/app/heir`,
        });
    }

    return releaseResults.instances;
  }

  async revokeRelease(userId: string, releaseId: string) {
      const release = await this.prisma.releaseInstance.findUnique({
          where: { id: releaseId },
          include: { pack: true }
      });

      if (!release || release.pack.ownerId !== userId) {
          throw new NotFoundException("Release not found");
      }

      await this.prisma.$transaction([
          this.prisma.releaseInstance.update({
            where: { id: releaseId },
            data: { 
                status: ReleaseInstanceStatus.REVOKED,
                key: null // DESTROY KEY
            }
          }),
          this.prisma.auditEvent.create({
            data: {
                userId,
                eventType: "CONTINUITY_RELEASE_REVOKED",
                entityType: "ReleaseInstance",
                entityId: releaseId,
            }
          })
      ]);
      
      return { status: "revoked" };
  }
}
