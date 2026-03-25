import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ReleaseInstanceStatus } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "../../config/config.service";
import type { HeirAuthContext } from "../../auth/guards/heir-auth.guard";

@Injectable()
export class HeirService {
    constructor(
        private prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

  async login(email: string, accessCode: string) {
        // Multiple owners can have recipients with the same email; validate against accessCodeHash.
        const recipients = await this.prisma.continuityRecipient.findMany({
            where: { email },
        });

        if (!recipients || recipients.length === 0) {
            throw new ForbiddenException("Invalid credentials");
        }

        const hash = createHash("sha256").update(accessCode, "utf8").digest("hex");
        const matching = recipients.find(
            (r) => typeof r.accessCodeHash === "string" && r.accessCodeHash === hash,
        );

        // V1: do not allow login unless accessCodeHash exists and matches.
        if (!matching) {
            throw new ForbiddenException("Invalid credentials");
        }

        const payload = {
            sub: matching.id,
            recipientId: matching.id,
            ownerId: matching.ownerId,
            typ: "heir",
        };

        const token = await this.jwtService.signAsync(payload, {
            secret: this.configService.heirJwtSecret,
            expiresIn: this.configService.heirJwtExpiresIn as any,
        });

        return { token };
  }

    async getReleases(heir: HeirAuthContext) {
        const { recipientId, ownerId } = heir;
    return this.prisma.releaseInstance.findMany({
      where: {
        recipientId: recipientId,
                status: ReleaseInstanceStatus.RELEASED,
                pack: { ownerId },
      },
      include: {
        pack: {
          select: {
            name: true,
            description: true,
            releaseExpiryDays: true,
            revealCategory: true,
            revealExpiry: true,
            revealIssuer: true
          }
        }
      }
    });
  }

  async getRelease(heir: HeirAuthContext, releaseId: string) {
      const { recipientId, ownerId } = heir;
      const release = await this.prisma.releaseInstance.findUnique({
          where: { id: releaseId },
          include: {
              pack: true
          }
      });

      if (
        !release ||
        release.recipientId !== recipientId ||
        (release as any).pack?.ownerId !== ownerId
      ) {
          throw new NotFoundException("Release not found");
      }
      
      if (release.status !== ReleaseInstanceStatus.RELEASED) {
          throw new ForbiddenException("Release is not active");
      }

      return release;
  }

  async getReleaseItems(heir: HeirAuthContext, releaseId: string) {
      const { ownerId } = heir;
      const release = await this.getRelease(heir, releaseId);
      
      // Parse snapshot
      const snapshot = release.scopeSnapshot as any[]; // [{ lifeDocId, versionGroupId }]
      
      // In real imp we would fetch metadata for these items
      // We need to resolve them.
      // If we have lifeDocId, we can fetch it.
      
      const docIds = snapshot.map(s => s.lifeDocId).filter(Boolean);
      
      const docs = await this.prisma.lifeDoc.findMany({
          where: { id: { in: docIds }, ownerId },
          select: {
              id: true,
              title: true,
              category: true,
              expiryDate: true,
              issuingAuthority: true,
              maskedMode: true,
              aliasTitle: true,
              // We do NOT return vaultObjectId here unless requested for open
          }
      });
      
      // Apply privacy filters based on Pack settings
      return docs.map(doc => {
          const isMasked = release.pack.forceMaskedMode || doc.maskedMode;
          return {
              id: doc.id,
              title: isMasked ? (doc.aliasTitle || "Masked Document") : doc.title,
              category: release.pack.revealCategory ? doc.category : null,
              expiryDate: release.pack.revealExpiry ? doc.expiryDate : null,
              exhausted: false // TODO check expiry
          };
      });
  }

  async openItem(heir: HeirAuthContext, releaseId: string, docId: string) {
      const { ownerId } = heir;
      // This returns the Vault Object ID (pointer) so the frontend can download/decrypt
      // BUT "Access Gate" says "Heir experience... cannot expose broader Vault...".
      // "View Document opens Vault file viewer for that released item only"
      // "Release must be implemented as cryptographic access enablement"
      
      // In this Phase 3 prototype, we will return the vaultObjectId and cached keys if we had them.
      // Ideally the Key for the doc is encrypted with a key the Heir has access to.
      // Since we don't have the full crypto flow here, we'll return the pointer.
      
      const release = await this.getRelease(heir, releaseId);
      
      // Check if docId is in snapshot
      const snapshot = release.scopeSnapshot as any[];
      const isInSnapshot = snapshot.some(s => s.lifeDocId === docId);
      
      if (!isInSnapshot) throw new ForbiddenException("Item not in release");
      
      const doc = await this.prisma.lifeDoc.findUnique({
          where: { id: docId, ownerId }
      });
      
      if (!doc) throw new NotFoundException("Document not found");
      
      return {
          vaultObjectId: doc.vaultObjectId,
          fileHash: doc.fileHash,
          // We would also return the encrypted key wrapping for the heir here
      };
  }
}
