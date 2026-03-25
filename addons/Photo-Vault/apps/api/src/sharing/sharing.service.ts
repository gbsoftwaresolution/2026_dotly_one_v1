import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  GoneException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateShareDto,
  CreateShareResponse,
  SharedAlbumMetadataResponse,
  EncryptedShareBundleResponse,
  UnlockShareDto,
  SharedMediaDownloadUrlResponse,
  SharedMediaMetadataListResponse,
  ShareAnalyticsResponse,
} from "@booster-vault/shared";
import { ConfigService } from "../config/config.service";
import { randomBytes, randomUUID, createHash } from "crypto";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  private parseEncryptedMediaKeys(
    value: unknown,
  ): Array<{ mediaId: string; encryptedKey: string; iv: string }> | null {
    try {
      const parsed =
        typeof value === "string" ? (JSON.parse(value) as unknown) : value;

      if (!Array.isArray(parsed)) return null;

      // Minimal shape validation
      for (const item of parsed) {
        if (
          !item ||
          typeof (item as any).mediaId !== "string" ||
          typeof (item as any).encryptedKey !== "string" ||
          typeof (item as any).iv !== "string"
        ) {
          return null;
        }
      }

      return parsed as Array<{
        mediaId: string;
        encryptedKey: string;
        iv: string;
      }>;
    } catch {
      return null;
    }
  }

  /**
   * Create a share stub for an album.
   *
   * This creates the share record first; the encrypted bundle can be uploaded later.
   */
  async createShareStub(
    ownerUserId: string,
    albumId: string,
    dto: CreateShareDto,
  ): Promise<CreateShareResponse> {
    // Validate album ownership and existence
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== ownerUserId) {
      throw new ForbiddenException("Not authorized to share this album");
    }

    if (album.isDeleted) {
      throw new BadRequestException("Cannot share a deleted album");
    }

    const now = new Date();

    // Calculate expiration
    const expiresInDays = dto?.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // NOTE: Prisma schema enforces @@unique([albumId, ownerUserId]).
    // That means there can only ever be one SharedAlbum row per album+owner.
    // So "creating" a new share link for the same album must reuse/update the existing row.
    const existingShare = await this.prisma.sharedAlbum.findFirst({
      where: {
        albumId,
        ownerUserId,
      },
    });

    const wasActive =
      !!existingShare &&
      existingShare.revokedAt == null &&
      existingShare.expiresAt != null &&
      existingShare.expiresAt > now;

    const shareId = existingShare?.id ?? randomUUID();

    if (existingShare) {
      // Re-activate / extend and reset bundle so the client can upload a fresh encrypted snapshot.
      await this.prisma.sharedAlbum.update({
        where: { id: shareId },
        data: {
          expiresAt,
          revokedAt: null,
          encryptedAlbumKey: null,
          encryptedMediaKeys: Prisma.DbNull,
          iv: null,
          kdfParams: Prisma.DbNull,
          bundleUploadedAt: null,
          viewCount: 0,
          lastViewedAt: null,
        },
      });
    } else {
      try {
        await this.prisma.sharedAlbum.create({
          data: {
            id: shareId,
            ownerUserId,
            albumId,
            expiresAt,
          },
        });
      } catch (err: any) {
        // If two requests race, the unique constraint may win in DB.
        // Convert that into a deterministic "reuse" behavior instead of a 500.
        if (err?.code === "P2002") {
          const racedShare = await this.prisma.sharedAlbum.findFirst({
            where: { albumId, ownerUserId },
          });

          if (!racedShare) throw err;

          await this.prisma.sharedAlbum.update({
            where: { id: racedShare.id },
            data: {
              expiresAt,
              revokedAt: null,
              encryptedAlbumKey: null,
              encryptedMediaKeys: Prisma.DbNull,
              iv: null,
              kdfParams: Prisma.DbNull,
              bundleUploadedAt: null,
              viewCount: 0,
              lastViewedAt: null,
            },
          });

          // Use the existing ID for response
          const baseUrl = this.configService.webAppUrl;
          const shareLink = `${baseUrl}/shared/${racedShare.id}`;

          return {
            shareId: racedShare.id,
            shareLink,
            sharePassphrase: "",
            expiresAt,
          };
        }

        throw err;
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        userId: ownerUserId,
        eventType: "SHARE_CREATED",
        entityType: "ALBUM",
        entityId: albumId,
        meta: {
          shareId,
          expiresAt,
          expiresInDays,
          twoStep: true,
          reused: !!existingShare,
          wasActive,
        },
      },
    });

    // Generate share link
    const baseUrl = this.configService.webAppUrl;
    const shareLink = `${baseUrl}/shared/${shareId}`;

    // Passphrase is generated client-side; kept in response for backward compatibility.
    return {
      shareId,
      shareLink,
      sharePassphrase: "",
      expiresAt,
    };
  }

  /**
   * Create a share for an album
   */
  async createShare(
    ownerUserId: string,
    albumId: string,
    dto: CreateShareDto,
    encryptedAlbumKey: Buffer,
    encryptedMediaKeys: Array<{
      mediaId: string;
      encryptedKey: string;
      iv: string;
    }>,
    iv: Buffer,
    kdfParams: any,
  ): Promise<CreateShareResponse> {
    const stub = await this.createShareStub(ownerUserId, albumId, dto);

    await this.uploadShareBundle(
      ownerUserId,
      stub.shareId,
      encryptedAlbumKey,
      encryptedMediaKeys,
      iv,
      kdfParams,
    );

    return stub;
  }

  /**
   * Upload encrypted bundle for an existing share (owner only)
   */
  async uploadShareBundle(
    ownerUserId: string,
    shareId: string,
    encryptedAlbumKey: Buffer,
    encryptedMediaKeys: Array<{
      mediaId: string;
      encryptedKey: string;
      iv: string;
    }>,
    iv: Buffer,
    kdfParams: any,
  ): Promise<void> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (share.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("Not authorized to update this share");
    }

    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    await this.prisma.sharedAlbum.update({
      where: { id: shareId },
      data: {
        encryptedAlbumKey,
        encryptedMediaKeys,
        iv,
        kdfParams,
        bundleUploadedAt: new Date(),
      },
    });
  }

  /**
   * Get share metadata (public endpoint)
   */
  async getShareMetadata(
    shareId: string,
  ): Promise<SharedAlbumMetadataResponse> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
      include: {
        album: true,
      },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    // Check if share is expired
    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    // Check if share is revoked
    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    // Map album to response (excluding sensitive fields)
    const albumResponse = {
      id: share.album.id,
      name: share.album.name,
      description: share.album.description || undefined,
      coverMediaId: share.album.coverMediaId || undefined,
      isDeleted: share.album.isDeleted,
      deletedAt: share.album.deletedAt || undefined,
      createdAt: share.album.createdAt,
      updatedAt: share.album.updatedAt,
    };

    return {
      shareId: share.id,
      ownerUserId: share.ownerUserId,
      album: albumResponse,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt || undefined,
    };
  }

  /**
   * Unlock share with passphrase (public endpoint)
   */
  async unlockShare(
    shareId: string,
    _dto: UnlockShareDto, // Parameter kept for API consistency but unused server-side
  ): Promise<EncryptedShareBundleResponse> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    // Check if share is expired
    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    // Check if share is revoked
    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    if (!share.encryptedAlbumKey || !share.iv || !share.kdfParams) {
      throw new ConflictException(
        "Share bundle has not been uploaded yet. Please try again in a moment.",
      );
    }

    // Note: Passphrase validation is client-side only
    // Server returns encrypted bundle regardless - passphrase validation happens client-side
    // This ensures zero-knowledge (server never knows the passphrase)

    // Create a share access token
    const { rawToken, expiresAt: tokenExpiresAt } =
      await this.createShareAccessToken(shareId);

    const encryptedMediaKeys = this.parseEncryptedMediaKeys(
      share.encryptedMediaKeys,
    );

    if (!encryptedMediaKeys) {
      throw new ConflictException(
        "Share bundle is incomplete. Please recreate the share.",
      );
    }

    return {
      shareId: share.id,
      encryptedAlbumKey: share.encryptedAlbumKey.toString("base64"),
      encryptedMediaKeys: encryptedMediaKeys.map((item) => ({
        mediaId: item.mediaId,
        encryptedKey: item.encryptedKey,
        iv: item.iv,
      })),
      iv: share.iv.toString("base64"),
      kdfParams: share.kdfParams as any,
      shareAccessToken: rawToken,
      tokenExpiresAt,
    };
  }

  /**
   * Revoke a share (owner only)
   */
  async revokeShare(ownerUserId: string, shareId: string): Promise<void> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (share.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("Not authorized to revoke this share");
    }

    if (share.revokedAt) {
      throw new BadRequestException("Share is already revoked");
    }

    // Revoke all access tokens for this share
    await this.prisma.shareAccessToken.updateMany({
      where: { shareId },
      data: { revokedAt: new Date(), updatedAt: new Date() },
    });

    await this.prisma.sharedAlbum.update({
      where: { id: shareId },
      data: {
        revokedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId: ownerUserId,
        eventType: "SHARE_REVOKED",
        entityType: "ALBUM",
        entityId: share.albumId,
        meta: { shareId },
      },
    });
  }

  /**
   * Get signed download URL for shared media (public endpoint, requires X-Share-Token)
   */
  async getSharedMediaDownloadUrl(
    shareId: string,
    mediaId: string,
    rawToken: string,
    variant?: string,
  ): Promise<SharedMediaDownloadUrlResponse> {
    // Validate share exists and is active
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    // Validate token
    const tokenValid = await this.validateShareAccessToken(shareId, rawToken);
    if (!tokenValid) {
      throw new UnauthorizedException("Invalid or expired share token");
    }

    // Check if mediaId belongs to the shared album snapshot
    const encryptedMediaKeys = this.parseEncryptedMediaKeys(
      share.encryptedMediaKeys,
    );
    if (!encryptedMediaKeys) {
      throw new ConflictException(
        "Share bundle is incomplete. Please ask the owner to recreate the share.",
      );
    }

    const mediaInShare = encryptedMediaKeys.find(
      (item) => item.mediaId === mediaId,
    );
    if (!mediaInShare) {
      throw new NotFoundException("Media not found in this shared album");
    }

    // Fetch media metadata to get objectKey
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== share.ownerUserId) {
      throw new NotFoundException("Media not found");
    }

    if (media.isTrashed) {
      throw new GoneException("Media has been trashed");
    }

    const normalizedVariant = (variant || "original").toLowerCase();
    const objectKey =
      normalizedVariant === "thumb" || normalizedVariant === "thumbnail"
        ? media.thumbObjectKey
        : media.objectKey;

    if (!objectKey) {
      throw new BadRequestException("Thumbnail not available");
    }

    // Generate signed download URL
    const signedUrl =
      await this.storageService.createSignedDownloadUrl(objectKey);

    return {
      url: signedUrl.url,
      expiresAt: signedUrl.expiresAt,
      method: signedUrl.method,
      headers: signedUrl.headers,
      media: {
        id: media.id,
        ownerUserId: share.ownerUserId,
        type: media.type,
        byteSize: Number(media.byteSize),
        contentType: media.contentType,
        encMeta: media.encMeta as any,
        thumbByteSize: media.thumbByteSize
          ? Number(media.thumbByteSize)
          : undefined,
        thumbContentType: media.thumbContentType || undefined,
        thumbEncMeta: (media.thumbEncMeta as any) || undefined,
        thumbUploadedAt: media.thumbUploadedAt || undefined,
        originalFilename: media.originalFilename || undefined,
        createdAt: media.createdAt,
        updatedAt: media.updatedAt,
      },
    };
  }

  /**
   * List shared media metadata (public endpoint; requires X-Share-Token).
   * Returns only non-sensitive metadata; does not include keys.
   */
  async listSharedMediaMetadata(
    shareId: string,
    rawToken: string,
    cursor?: number,
    limit?: number,
  ): Promise<SharedMediaMetadataListResponse> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    const tokenValid = await this.validateShareAccessToken(shareId, rawToken);
    if (!tokenValid) {
      throw new UnauthorizedException("Invalid or expired share token");
    }

    const encryptedMediaKeys = this.parseEncryptedMediaKeys(
      share.encryptedMediaKeys,
    );
    if (!encryptedMediaKeys) {
      throw new ConflictException(
        "Share bundle is incomplete. Please ask the owner to recreate the share.",
      );
    }

    const allMediaIds = encryptedMediaKeys.map((k) => k.mediaId);
    const start =
      Number.isFinite(cursor as any) && (cursor as number) > 0
        ? (cursor as number)
        : 0;
    const effectiveLimit = Math.min(
      Math.max(Number.isFinite(limit as any) ? (limit as number) : 200, 1),
      500,
    );

    const pageIds = allMediaIds.slice(start, start + effectiveLimit);
    if (pageIds.length === 0) {
      return { items: [] };
    }

    const rows = await this.prisma.media.findMany({
      where: {
        id: { in: pageIds },
        userId: share.ownerUserId,
      },
      select: {
        id: true,
        type: true,
        byteSize: true,
        contentType: true,
        encMeta: true,
        thumbByteSize: true,
        thumbContentType: true,
        thumbEncMeta: true,
        thumbUploadedAt: true,
        originalFilename: true,
        exifTakenAt: true,
        takenAt: true,
        isTrashed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const byId = new Map(rows.map((r) => [r.id, r]));

    const items = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .filter((m) => !(m as any).isTrashed)
      .map((m) => ({
        id: (m as any).id,
        ownerUserId: share.ownerUserId,
        type: (m as any).type,
        byteSize: Number((m as any).byteSize),
        contentType: (m as any).contentType,
        encMeta: (m as any).encMeta,
        thumbByteSize:
          (m as any).thumbByteSize != null
            ? Number((m as any).thumbByteSize)
            : undefined,
        thumbContentType: (m as any).thumbContentType || undefined,
        thumbEncMeta: (m as any).thumbEncMeta || undefined,
        thumbUploadedAt: (m as any).thumbUploadedAt || undefined,
        originalFilename: (m as any).originalFilename || undefined,
        exifTakenAt: (m as any).exifTakenAt || undefined,
        takenAt: (m as any).takenAt || undefined,
        createdAt: (m as any).createdAt,
        updatedAt: (m as any).updatedAt,
      }));

    const nextCursor =
      start + effectiveLimit < allMediaIds.length
        ? start + effectiveLimit
        : undefined;
    return { items, nextCursor };
  }

  /**
   * Track a successful share view (public; requires X-Share-Token).
   * Callers should invoke this only after client-side decrypt succeeds.
   */
  async trackShareView(shareId: string, rawToken: string): Promise<void> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    if (share.expiresAt < new Date()) {
      throw new GoneException("This share has expired");
    }

    if (share.revokedAt) {
      throw new GoneException("This share has been revoked");
    }

    const tokenValid = await this.validateShareAccessToken(shareId, rawToken);
    if (!tokenValid) {
      throw new UnauthorizedException("Invalid or expired share token");
    }

    await this.prisma.sharedAlbum.update({
      where: { id: shareId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
  }

  /**
   * Get share analytics (owner only).
   */
  async getShareAnalytics(
    ownerUserId: string,
    shareId: string,
  ): Promise<ShareAnalyticsResponse> {
    const share = await this.prisma.sharedAlbum.findUnique({
      where: { id: shareId },
      select: {
        id: true,
        ownerUserId: true,
        viewCount: true,
        lastViewedAt: true,
      },
    });

    if (!share || share.ownerUserId !== ownerUserId) {
      throw new NotFoundException("Share not found");
    }

    return {
      shareId: share.id,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt || undefined,
    };
  }

  /**
   * List active shares for a user
   */
  async listUserShares(ownerUserId: string) {
    const shares = await this.prisma.sharedAlbum.findMany({
      where: {
        ownerUserId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        album: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return shares.map((share) => ({
      id: share.id,
      album: {
        id: share.album.id,
        name: share.album.name,
        description: share.album.description || undefined,
        coverMediaId: share.album.coverMediaId || undefined,
      },
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      viewCount: share.viewCount,
      lastViewedAt: share.lastViewedAt || undefined,
    }));
  }

  /**
   * Create a share access token with TTL
   */
  private async createShareAccessToken(
    shareId: string,
  ): Promise<{ rawToken: string; tokenHash: string; expiresAt: Date }> {
    // Generate cryptographically secure random token (32 bytes)
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    // Calculate expiration (15 minutes default)
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + this.configService.shareTokenTtlSeconds,
    );

    // Store token hash in database
    await this.prisma.shareAccessToken.create({
      data: {
        shareId,
        tokenHash,
        expiresAt,
      },
    });

    return { rawToken, tokenHash, expiresAt };
  }

  /**
   * Validate a share access token
   */
  private async validateShareAccessToken(
    shareId: string,
    rawToken: string,
  ): Promise<boolean> {
    if (!rawToken) return false;

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const token = await this.prisma.shareAccessToken.findUnique({
      where: { tokenHash },
      include: { share: true },
    });

    if (!token) return false;

    // Check if token belongs to the correct share
    if (token.shareId !== shareId) return false;

    // Check if token is expired
    if (token.expiresAt < new Date()) return false;

    // Check if token is revoked
    if (token.revokedAt) return false;

    // Check if the share itself is still valid
    if (token.share.revokedAt || token.share.expiresAt < new Date())
      return false;

    return true;
  }
}
