import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfigService } from "../config/config.service";
import { Prisma, SubscriptionStatus } from "@prisma/client";
import { ApiErrorCode } from "../shared/api-error-codes";
import { AuditEventType } from "../audit/audit-event-types";
import {
  UploadIntentDto,
  UploadThumbnailDto,
  CompleteUploadDto,
  MediaResponse,
  PaginatedMediaResponse,
  SignedUploadUrlResponse,
  SignedDownloadUrlResponse,
  MediaType as SharedMediaType,
  MultipartUploadInitResponse,
  MultipartUploadPartUrlResponse,
  MultipartUploadStatusResponse,
  MultipartCompleteRequest,
} from "@booster-vault/shared";
import { ThumbnailsQueue } from "./thumbnails.queue";

const normalizeContentType = (contentType: string): string => {
  const first = (String(contentType || "").split(";")[0] ?? "").trim();
  return first.toLowerCase();
};

const getFileExtLower = (filename?: string | null): string => {
  const name = String(filename || "");
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "";
};

const TIER1_DOCUMENT_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
]);

const TIER1_DOCUMENT_EXTS = new Set<string>([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
]);

const isTier1Document = (contentType: string, filename?: string | null) => {
  const ct = normalizeContentType(contentType);
  if (TIER1_DOCUMENT_CONTENT_TYPES.has(ct)) return true;
  const ext = getFileExtLower(filename);
  return TIER1_DOCUMENT_EXTS.has(ext);
};

const uploadSubscriptionInclude = {
  user: { include: { usage: true } },
} satisfies Prisma.SubscriptionInclude;

type SubscriptionWithUsage = Prisma.SubscriptionGetPayload<{
  include: typeof uploadSubscriptionInclude;
}>;

@Injectable()
export class MediaService {
  private static readonly RECOVERY_REQUIRED_MESSAGE =
    "Recovery phrase is not enabled. Enable recovery or explicitly accept the risk before uploading.";

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly thumbnailsQueue: ThumbnailsQueue,
  ) {}

  private static recoveryRequiredError(requestId?: string) {
    return {
      code: ApiErrorCode.RECOVERY_REQUIRED,
      message: MediaService.RECOVERY_REQUIRED_MESSAGE,
      requestId: requestId ?? null,
    };
  }

  getMultipartSupport(): {
    supported: boolean;
    partSize: number;
    minPartSize: number;
    maxParts: number;
    threshold: number;
  } {
    return {
      supported: this.storageService.supportsMultipartUpload(),
      partSize: this.configService.multipartPartSizeBytes,
      minPartSize: 5 * 1024 * 1024,
      maxParts: 10_000,
      threshold: this.configService.multipartThresholdBytes,
    };
  }

  /**
   * Create an upload intent for a new media item
   */
  async createUploadIntent(
    userId: string,
    dto: UploadIntentDto,
    requestId?: string,
  ): Promise<{
    media: MediaResponse;
    signedUploadUrl: SignedUploadUrlResponse;
    signedThumbnailUploadUrl?: SignedUploadUrlResponse;
    multipart?: {
      supported: boolean;
      partSize: number;
      minPartSize: number;
      maxParts: number;
      threshold: number;
    };
  }> {
    // 0. Check if uploads are disabled via kill switch
    if (this.configService.disableUploads) {
      throw new ForbiddenException(
        "Uploads are temporarily disabled for maintenance",
      );
    }

    const subscription = await this.getUploadSubscriptionContext(userId);

    // 1. Enforce recovery/risk acceptance gate (real usage boundary)
    await this.enforceRecoveryUploadGate(userId, subscription, requestId);

    // 2. Enforce plan rules
    await this.enforceUploadPlan(subscription);

    // 2.1 Documents: Tier-2 uploads are allowed.
    // Tier-1 is the set we consider preview-capable (UI hints, future policy).
    if (dto.type === SharedMediaType.DOCUMENT) {
      // Tier-2: allow any other document content-type/extension as an opaque
      // encrypted blob (download-only). Tier-1 remains the set we can preview.
      // We keep isTier1Document() for UI hints and future policy tightening.
      void isTier1Document(dto.contentType, dto.originalFilename);
    }

    // 3. Generate object key
    const mediaId = randomUUID();
    const objectKey = `u/${userId}/m/${mediaId}.bin`;
    const thumbObjectKey = dto.thumbnail
      ? `u/${userId}/m/${mediaId}.thumb.bin`
      : null;

    // 4. Create media record in transaction
    const media = await this.prisma.$transaction(async (tx) => {
      const media = await tx.media.create({
        data: {
          id: mediaId,
          userId,
          type: dto.type,
          objectKey,
          byteSize: dto.byteSize,
          contentType: dto.contentType,
          encAlgo: dto.encAlgo,
          encMeta: dto.encMeta,

          ...(dto.thumbnail
            ? {
                thumbObjectKey,
                thumbByteSize: dto.thumbnail.byteSize,
                thumbContentType: dto.thumbnail.contentType,
                thumbEncMeta: dto.thumbnail.encMeta,
                thumbUploadedAt: null,
              }
            : {}),

          originalFilename: dto.originalFilename,
          sha256Ciphertext: dto.sha256CiphertextB64
            ? Buffer.from(dto.sha256CiphertextB64, "base64")
            : null,
          exifTakenAt: dto.exifTakenAt,
          exifLat: dto.exifLat,
          exifLng: dto.exifLng,
          title: dto.title,
          note: dto.note,
          takenAt: dto.takenAt,
          locationText: dto.locationText,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_UPLOAD_INTENT_CREATED",
          entityType: "MEDIA",
          entityId: media.id,
          meta: {
            type: dto.type,
            byteSize: dto.byteSize,
            contentType: dto.contentType,
            ...(dto.thumbnail
              ? {
                  thumbnail: {
                    byteSize: dto.thumbnail.byteSize,
                    contentType: dto.thumbnail.contentType,
                  },
                }
              : {}),
          },
        },
      });

      return media;
    });

    // 5. Generate signed upload URL
    const signedUploadUrl = await this.storageService.createSignedUploadUrl(
      objectKey,
      dto.contentType,
      dto.byteSize,
    );

    const signedThumbnailUploadUrl = dto.thumbnail
      ? await this.storageService.createSignedUploadUrl(
          thumbObjectKey!,
          dto.thumbnail.contentType,
          dto.thumbnail.byteSize,
        )
      : null;

    return {
      media: this.mapMediaToResponse(media),
      signedUploadUrl: {
        url: signedUploadUrl.url,
        headers: signedUploadUrl.headers,
        expiresAt: signedUploadUrl.expiresAt,
        method: signedUploadUrl.method,
      },
      multipart: {
        supported: this.storageService.supportsMultipartUpload(),
        partSize: this.configService.multipartPartSizeBytes,
        minPartSize: 5 * 1024 * 1024,
        maxParts: 10_000,
        threshold: this.configService.multipartThresholdBytes,
      },
      ...(signedThumbnailUploadUrl
        ? {
            signedThumbnailUploadUrl: {
              url: signedThumbnailUploadUrl.url,
              headers: signedThumbnailUploadUrl.headers,
              expiresAt: signedThumbnailUploadUrl.expiresAt,
              method: signedThumbnailUploadUrl.method,
            },
          }
        : {}),
    };
  }

  private async requireOwnedMedia(userId: string, mediaId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) throw new NotFoundException("Media not found");
    if (media.userId !== userId)
      throw new ForbiddenException("Not authorized to access this media");
    return media;
  }

  async initMultipartUpload(
    userId: string,
    mediaId: string,
  ): Promise<MultipartUploadInitResponse> {
    const media = await this.requireOwnedMedia(userId, mediaId);

    if (!this.storageService.supportsMultipartUpload()) {
      throw new BadRequestException(
        "Multipart upload requires S3-compatible storage (DigitalOcean Spaces/S3/MinIO)",
      );
    }

    const { uploadId } = await this.storageService.createMultipartUpload({
      objectKey: media.objectKey,
      contentType: media.contentType,
    });

    return {
      uploadId,
      partSize: this.configService.multipartPartSizeBytes,
    };
  }

  async getMultipartUploadPartUrl(args: {
    userId: string;
    mediaId: string;
    uploadId: string;
    partNumber: number;
  }): Promise<MultipartUploadPartUrlResponse> {
    const media = await this.requireOwnedMedia(args.userId, args.mediaId);

    if (!this.storageService.supportsMultipartUpload()) {
      throw new BadRequestException(
        "Multipart upload requires S3-compatible storage (DigitalOcean Spaces/S3/MinIO)",
      );
    }

    if (
      !Number.isInteger(args.partNumber) ||
      args.partNumber < 1 ||
      args.partNumber > 10_000
    ) {
      throw new BadRequestException("Invalid partNumber");
    }

    const uploadUrl = await this.storageService.createSignedUploadPartUrl({
      objectKey: media.objectKey,
      uploadId: args.uploadId,
      partNumber: args.partNumber,
    });

    return {
      partNumber: args.partNumber,
      uploadUrl: {
        url: uploadUrl.url,
        headers: uploadUrl.headers,
        expiresAt: uploadUrl.expiresAt,
        method: uploadUrl.method,
      },
    };
  }

  async getMultipartUploadStatus(args: {
    userId: string;
    mediaId: string;
    uploadId: string;
  }): Promise<MultipartUploadStatusResponse> {
    const media = await this.requireOwnedMedia(args.userId, args.mediaId);

    if (!this.storageService.supportsMultipartUpload()) {
      throw new BadRequestException(
        "Multipart upload requires S3-compatible storage (DigitalOcean Spaces/S3/MinIO)",
      );
    }

    const { parts } = await this.storageService.listMultipartParts({
      objectKey: media.objectKey,
      uploadId: args.uploadId,
    });

    return { parts };
  }

  async completeMultipartUpload(args: {
    userId: string;
    mediaId: string;
    uploadId: string;
    body: MultipartCompleteRequest;
  }): Promise<{ etag?: string }> {
    const media = await this.requireOwnedMedia(args.userId, args.mediaId);

    if (!this.storageService.supportsMultipartUpload()) {
      throw new BadRequestException(
        "Multipart upload requires S3-compatible storage (DigitalOcean Spaces/S3/MinIO)",
      );
    }

    const parts = Array.isArray(args.body?.parts) ? args.body.parts : [];
    if (parts.length === 0) {
      throw new BadRequestException("parts is required");
    }

    const seen = new Set<number>();
    for (const p of parts) {
      if (!p || typeof p !== "object")
        throw new BadRequestException("Invalid parts");
      if (
        !Number.isInteger(p.partNumber) ||
        p.partNumber < 1 ||
        p.partNumber > 10_000
      )
        throw new BadRequestException("Invalid partNumber");
      if (typeof p.etag !== "string" || p.etag.length < 1)
        throw new BadRequestException("Invalid etag");
      if (seen.has(p.partNumber))
        throw new BadRequestException("Duplicate partNumber");
      seen.add(p.partNumber);
    }

    const result = await this.storageService.completeMultipartUpload({
      objectKey: media.objectKey,
      uploadId: args.uploadId,
      parts,
    });
    return result;
  }

  async abortMultipartUpload(args: {
    userId: string;
    mediaId: string;
    uploadId: string;
  }): Promise<void> {
    const media = await this.requireOwnedMedia(args.userId, args.mediaId);

    if (!this.storageService.supportsMultipartUpload()) {
      throw new BadRequestException(
        "Multipart upload requires S3-compatible storage (DigitalOcean Spaces/S3/MinIO)",
      );
    }

    await this.storageService.abortMultipartUpload({
      objectKey: media.objectKey,
      uploadId: args.uploadId,
    });
  }

  /**
   * Complete an upload after client has uploaded the ciphertext
   */
  async completeUpload(
    userId: string,
    mediaId: string,
    dto: CompleteUploadDto,
  ): Promise<MediaResponse> {
    // 1. Find media and verify ownership
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this media");
    }

    // Ensure object exists in storage before completing.
    // (We don't rely on client-provided ETag because browsers cannot always read it
    // from cross-origin signed URL responses unless CORS exposes it.)
    const exists = await this.storageService.objectExists(media.objectKey);
    if (!exists) {
      throw new BadRequestException("Upload not found in storage");
    }

    let thumbExists = false;
    if (media.thumbObjectKey) {
      thumbExists = await this.storageService.objectExists(
        media.thumbObjectKey,
      );
    }

    // 2. Check if already completed (idempotency check)
    if (media.uploadedAt) {
      // Already completed, return existing media without updating counters
      return this.mapMediaToResponse(media);
    }

    // 3. Update usage counters transactionally
    const updatedMedia = await this.prisma.$transaction(async (tx) => {
      const sha256Ciphertext =
        typeof dto.sha256CiphertextB64 === "string" && dto.sha256CiphertextB64
          ? Buffer.from(dto.sha256CiphertextB64, "base64")
          : undefined;
      if (sha256Ciphertext && sha256Ciphertext.byteLength !== 32) {
        throw new BadRequestException("Invalid sha256CiphertextB64");
      }

      // Get current usage
      const usage = await tx.userUsage.findUnique({
        where: { userId },
      });

      if (!usage) {
        throw new NotFoundException("User usage record not found");
      }

      // Update usage counters
      await tx.userUsage.update({
        where: { userId },
        data: {
          totalMediaCount: { increment: 1 },
          ...(media.type === SharedMediaType.PHOTO
            ? { totalPhotoCount: { increment: 1 } }
            : media.type === SharedMediaType.VIDEO
              ? { totalVideoCount: { increment: 1 } }
              : {}),
          updatedAt: new Date(),
        },
      });

      // Update media with uploadedAt timestamp
      const updated = await tx.media.update({
        where: { id: mediaId },
        data: {
          uploadedAt: new Date(),
          ...(dto.encMeta ? { encMeta: dto.encMeta as any } : {}),
          ...(sha256Ciphertext ? { sha256Ciphertext } : {}),
          ...(media.thumbObjectKey
            ? { thumbUploadedAt: thumbExists ? new Date() : null }
            : {}),
          updatedAt: new Date(),
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_UPLOADED",
          entityType: "MEDIA",
          entityId: mediaId,
          meta: {
            ...(dto.etag ? { etag: dto.etag } : {}),
            type: media.type,
          },
        },
      });

      return updated;
    });

    // If we tracked a thumbnail objectKey but it wasn't present at completion time,
    // enqueue a verification job so we can pick it up later.
    if (updatedMedia.thumbObjectKey && !updatedMedia.thumbUploadedAt) {
      await this.thumbnailsQueue.enqueueVerify({
        mediaId: updatedMedia.id,
        userId,
      });
    }

    return this.mapMediaToResponse(updatedMedia);
  }

  /**
   * Create upload intent for an encrypted thumbnail (client-generated).
   */
  async createThumbnailUploadIntent(
    userId: string,
    mediaId: string,
    dto: UploadThumbnailDto,
    requestId?: string,
  ): Promise<{
    media: MediaResponse;
    signedThumbnailUploadUrl: SignedUploadUrlResponse;
  }> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this media");
    }

    if (!media.uploadedAt) {
      throw new BadRequestException(
        "Upload must be completed before thumbnail can be uploaded",
      );
    }

    const thumbObjectKey =
      media.thumbObjectKey || `u/${userId}/m/${mediaId}.thumb.bin`;

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        thumbObjectKey,
        thumbByteSize: dto.byteSize,
        thumbContentType: dto.contentType,
        thumbEncMeta: dto.encMeta,
        // reset verification until the object is confirmed
        thumbUploadedAt: null,
        updatedAt: new Date(),
      },
    });

    const signedThumbnailUploadUrl =
      await this.storageService.createSignedUploadUrl(
        thumbObjectKey,
        dto.contentType,
        dto.byteSize,
      );

    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "MEDIA_THUMBNAIL_UPLOAD_INTENT_CREATED",
        entityType: "MEDIA",
        entityId: mediaId,
        meta: {
          byteSize: dto.byteSize,
          contentType: dto.contentType,
        },
      },
    });

    // Queue a verify to be safe if completion webhook isn't called.
    await this.thumbnailsQueue.enqueueVerify({ mediaId, userId, requestId });

    return {
      media: this.mapMediaToResponse(updated),
      signedThumbnailUploadUrl: {
        url: signedThumbnailUploadUrl.url,
        headers: signedThumbnailUploadUrl.headers,
        expiresAt: signedThumbnailUploadUrl.expiresAt,
        method: signedThumbnailUploadUrl.method,
      },
    };
  }

  /**
   * Complete thumbnail upload (client has uploaded ciphertext to thumbObjectKey).
   */
  async completeThumbnailUpload(
    userId: string,
    mediaId: string,
    dto: CompleteUploadDto,
    requestId?: string,
  ): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this media");
    }

    if (!media.thumbObjectKey) {
      throw new BadRequestException("Thumbnail upload intent not created");
    }

    // Ensure object exists
    const exists = await this.storageService.objectExists(media.thumbObjectKey);
    if (!exists) {
      throw new BadRequestException("Thumbnail upload not found in storage");
    }

    // Idempotency
    if (media.thumbUploadedAt) {
      return this.mapMediaToResponse(media);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedMedia = await tx.media.update({
        where: { id: mediaId },
        data: {
          thumbUploadedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_THUMBNAIL_UPLOADED",
          entityType: "MEDIA",
          entityId: mediaId,
          meta: {
            ...(dto.etag ? { etag: dto.etag } : {}),
          },
        },
      });

      return updatedMedia;
    });

    // Queue verification (HEAD) as a standard pipeline step.
    await this.thumbnailsQueue.enqueueVerify({ mediaId, userId, requestId });

    return this.mapMediaToResponse(updated);
  }

  /**
   * List user's media with pagination
   */
  async listMedia(
    userId: string,
    options: {
      includeTrashed?: boolean;
      limit?: number;
      cursor?: string;
      from?: Date;
      to?: Date;
      albumId?: string;
    },
  ): Promise<PaginatedMediaResponse> {
    const {
      includeTrashed = false,
      limit = 50,
      cursor,
      from,
      to,
      albumId,
    } = options;

    if (albumId) {
      return this.listMediaInAlbum(userId, {
        albumId,
        includeTrashed,
        limit,
        cursor,
        from,
        to,
      });
    }

    const cursorInfo = await this.parseMediaCursor(userId, cursor);

    const paginationWhere: Prisma.MediaWhereInput | null = cursorInfo
      ? {
          OR: [
            { createdAt: { lt: cursorInfo.createdAt } },
            {
              createdAt: cursorInfo.createdAt,
              id: { lt: cursorInfo.id },
            },
          ],
        }
      : null;

    const takenAtFilter: Prisma.MediaWhereInput =
      from || to
        ? {
            takenAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    const whereBase: Prisma.MediaWhereInput = {
      userId,
      ...(!includeTrashed ? { isTrashed: false } : {}),
      ...takenAtFilter,
    };

    const where: Prisma.MediaWhereInput = paginationWhere
      ? { AND: [whereBase, paginationWhere] }
      : whereBase;

    const media = await this.prisma.media.findMany({
      where,
      orderBy: [
        // Stable order: must match cursor filter.
        // createdAt ensures newly uploaded items show up immediately.
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1, // Fetch one extra to check if there's more
    });

    const hasMore = media.length > limit;
    const items = hasMore ? media.slice(0, limit) : media;
    const lastItem = items.at(-1);
    const nextCursor =
      hasMore && lastItem ? this.encodeMediaCursor(lastItem) : undefined;

    return {
      items: items.map((item) => this.mapMediaToResponse(item)),
      nextCursor,
      hasMore,
    };
  }

  private async listMediaInAlbum(
    userId: string,
    options: {
      albumId: string;
      includeTrashed?: boolean;
      limit?: number;
      cursor?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<PaginatedMediaResponse> {
    type AlbumItemWithMedia = Prisma.AlbumItemGetPayload<{
      include: { media: true };
    }>;

    const {
      albumId,
      includeTrashed = false,
      limit = 50,
      cursor,
      from,
      to,
    } = options;

    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this album");
    }

    let cursorWhere: Prisma.AlbumItemWhereInput = {};
    if (cursor) {
      // Cursor pagination based on (position, mediaId)
      // cursor format: "position,mediaId"
      const [positionStr, mediaId] = cursor.split(",");
      if (!positionStr || !mediaId) {
        throw new BadRequestException("Invalid cursor");
      }
      let position: bigint;
      try {
        position = BigInt(positionStr);
      } catch {
        throw new BadRequestException("Invalid cursor");
      }
      cursorWhere = {
        OR: [{ position: { gt: position } }, { position, mediaId: { gt: mediaId } }],
      };
    }

    const takenAtFilter: Prisma.MediaWhereInput =
      from || to
        ? {
            takenAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    const albumItems: AlbumItemWithMedia[] = await this.prisma.albumItem.findMany({
      where: {
        albumId,
        userId,
        ...cursorWhere,
        media: {
          userId,
          ...(!includeTrashed ? { isTrashed: false } : {}),
          ...takenAtFilter,
        },
      },
      include: { media: true },
      orderBy: [{ position: "asc" }, { mediaId: "asc" }],
      take: limit + 1,
    });

    const hasMore = albumItems.length > limit;
    const page = hasMore ? albumItems.slice(0, limit) : albumItems;
    const lastItem = page.at(-1);
    const nextCursor =
      hasMore && lastItem ? `${lastItem.position},${lastItem.mediaId}` : undefined;

    return {
      items: page.map((item) => this.mapMediaToResponse(item.media)),
      nextCursor,
      hasMore,
    };
  }

  private encodeMediaCursor(media: { id: string; createdAt: Date }): string {
    const payload = JSON.stringify({
      id: media.id,
      createdAt: media.createdAt.toISOString(),
    });
    return Buffer.from(payload, "utf8").toString("base64url");
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async parseMediaCursor(
    userId: string,
    cursor?: string,
  ): Promise<{ id: string; createdAt: Date } | null> {
    if (!cursor) return null;

    // Preferred: opaque base64url JSON cursor { id, createdAt }
    try {
      const json = Buffer.from(cursor, "base64url").toString("utf8");
      const parsed = JSON.parse(json);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as any).id === "string" &&
        typeof (parsed as any).createdAt === "string"
      ) {
        const createdAt = new Date((parsed as any).createdAt);
        if (!Number.isFinite(createdAt.getTime())) {
          throw new BadRequestException("Invalid cursor");
        }
        return { id: (parsed as any).id, createdAt };
      }
    } catch {
      // fall through
    }

    // Backward-compatible: legacy UUID cursor (previously used id-only)
    if (this.isUuid(cursor)) {
      const media = await this.prisma.media.findUnique({
        where: { id: cursor },
      });
      if (!media || media.userId !== userId) {
        throw new BadRequestException("Invalid cursor");
      }
      return { id: media.id, createdAt: media.createdAt };
    }

    throw new BadRequestException("Invalid cursor");
  }

  /**
   * Get a single media item
   */
  async getMedia(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this media");
    }

    return this.mapMediaToResponse(media);
  }

  /**
   * Update media metadata
   */
  async updateMedia(
    userId: string,
    mediaId: string,
    updates: {
      title?: string;
      note?: string;
      takenAt?: Date;
      locationText?: string;
    },
  ): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this media");
    }

    const updated = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "MEDIA_UPDATED",
        entityType: "MEDIA",
        entityId: mediaId,
        meta: { updates },
      },
    });

    return this.mapMediaToResponse(updated);
  }

  /**
   * Move media to trash
   */
  async trashMedia(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to trash this media");
    }

    if (media.isTrashed) {
      throw new BadRequestException("Media is already trashed");
    }

    const trashedAt = new Date();
    const purgeAfter = new Date(trashedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedMedia = await tx.media.update({
        where: { id: mediaId },
        data: {
          isTrashed: true,
          trashedAt,
          purgeAfter,
          updatedAt: new Date(),
        },
      });

      // Clear this media from any album covers
      await tx.album.updateMany({
        where: {
          userId,
          coverMediaId: mediaId,
        },
        data: {
          coverMediaId: null,
        },
      });

      // Increment trashed count
      await tx.userUsage.update({
        where: { userId },
        data: {
          trashedMediaCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_TRASHED",
          entityType: "MEDIA",
          entityId: mediaId,
          meta: { purgeAfter },
        },
      });

      return updatedMedia;
    });

    return this.mapMediaToResponse(updated);
  }

  /**
   * Restore media from trash
   */
  async restoreMedia(userId: string, mediaId: string): Promise<MediaResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to restore this media");
    }

    if (!media.isTrashed) {
      throw new BadRequestException("Media is not trashed");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedMedia = await tx.media.update({
        where: { id: mediaId },
        data: {
          isTrashed: false,
          trashedAt: null,
          purgeAfter: null,
          updatedAt: new Date(),
        },
      });

      // Decrement trashed count
      await tx.userUsage.update({
        where: { userId },
        data: {
          trashedMediaCount: { decrement: 1 },
          updatedAt: new Date(),
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_RESTORED",
          entityType: "MEDIA",
          entityId: mediaId,
        },
      });

      return updatedMedia;
    });

    return this.mapMediaToResponse(updated);
  }

  /**
   * Permanently delete (purge) media
   */
  async purgeMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to purge this media");
    }

    // Safety check: only allow purge if media is trashed OR explicitly allowed
    // For now, we require media to be trashed
    if (!media.isTrashed) {
      throw new BadRequestException(
        "Media must be trashed before it can be purged",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Clear this media from any album covers before deletion
      await tx.album.updateMany({
        where: {
          userId,
          coverMediaId: mediaId,
        },
        data: {
          coverMediaId: null,
        },
      });

      // Delete from storage
      await this.storageService.deleteObject(media.objectKey);
      if (media.thumbObjectKey) {
        await this.storageService.deleteObject(media.thumbObjectKey);
      }

      // Delete media record
      await tx.media.delete({
        where: { id: mediaId },
      });

      // Update usage counters
      await tx.userUsage.update({
        where: { userId },
        data: {
          totalMediaCount: { decrement: 1 },
          trashedMediaCount: { decrement: 1 },
          ...(media.type === SharedMediaType.PHOTO
            ? { totalPhotoCount: { decrement: 1 } }
            : media.type === SharedMediaType.VIDEO
              ? { totalVideoCount: { decrement: 1 } }
              : {}),
          updatedAt: new Date(),
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "MEDIA_PURGED",
          entityType: "MEDIA",
          entityId: mediaId,
        },
      });
    });
  }

  /**
   * Get a signed download URL for a media item
   */
  async getDownloadUrl(
    userId: string,
    mediaId: string,
    variant?: string,
  ): Promise<SignedDownloadUrlResponse> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this media");
    }

    const normalizedVariant = (variant || "original").toLowerCase();
    const objectKey =
      normalizedVariant === "thumb" || normalizedVariant === "thumbnail"
        ? media.thumbObjectKey
        : media.objectKey;

    if (!objectKey) {
      throw new BadRequestException("Thumbnail not available");
    }

    const signedUrl =
      await this.storageService.createSignedDownloadUrl(objectKey);

    // Create audit event (optional, could be noisy)
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "MEDIA_DOWNLOAD_URL_REQUESTED",
        entityType: "MEDIA",
        entityId: mediaId,
      },
    });

    return {
      url: signedUrl.url,
      headers: signedUrl.headers,
      expiresAt: signedUrl.expiresAt,
      method: signedUrl.method,
    };
  }

  /**
   * Enforce plan rules for uploads
   */
  private async enforceUploadPlan(
    subscription: SubscriptionWithUsage | null,
  ): Promise<void> {
    if (!subscription) {
      throw new ForbiddenException("No subscription found");
    }

    // If subscription status is not ACTIVE or TRIAL, block
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.TRIAL
    ) {
      throw new ForbiddenException(
        "Uploads blocked: subscription is not active or trial",
        { cause: "SUBSCRIPTION_INACTIVE" },
      );
    }

    // If TRIAL: check limits
    if (subscription.status === SubscriptionStatus.TRIAL) {
      const now = new Date();

      // Check trial period
      if (subscription.trialEndsAt && now > subscription.trialEndsAt) {
        throw new ForbiddenException(
          "Uploads blocked: trial period has ended",
          { cause: "TRIAL_EXPIRED" },
        );
      }

      // Check media count limit
      if (subscription.user?.usage) {
        const totalMedia = Number(subscription.user.usage.totalMediaCount);
        if (totalMedia >= subscription.trialMediaLimit) {
          throw new ForbiddenException(
            `Uploads blocked: trial media limit (${subscription.trialMediaLimit}) reached`,
            { cause: "TRIAL_LIMIT_REACHED" },
          );
        }
      }
    }

    // If ACTIVE: for now allow uploads (no hard caps)
    // Future: add plan-specific limits
  }

  private async getUploadSubscriptionContext(userId: string) {
    return this.prisma.subscription.findUnique({
      where: { userId },
      include: uploadSubscriptionInclude,
    });
  }

  private async enforceRecoveryUploadGate(
    userId: string,
    subscription: SubscriptionWithUsage | null,
    requestId?: string,
  ): Promise<void> {
    const bundle = await this.prisma.recoveryBundle.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (bundle) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { acceptedVaultRecoveryRiskAt: true },
    });

    if (user?.acceptedVaultRecoveryRiskAt) {
      return;
    }

    // Optional TRIAL grace uploads before enforcement.
    if (subscription?.status === SubscriptionStatus.TRIAL) {
      const graceUploads = this.configService.recoveryTrialGraceUploads;
      if (graceUploads > 0) {
        const totalMedia = Number(
          subscription.user?.usage?.totalMediaCount ?? 0,
        );
        if (totalMedia < graceUploads) {
          return;
        }
      }
    }

    // Audit (internal visibility) and reject.
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: AuditEventType.UPLOAD_BLOCKED_RECOVERY_REQUIRED,
        entityType: "MEDIA",
        entityId: null,
        meta: {
          requestId,
        },
      },
    });

    throw new ForbiddenException(MediaService.recoveryRequiredError(requestId));
  }

  /**
   * Map Prisma Media to API response
   */
  private mapMediaToResponse(media: any): MediaResponse {
    return {
      id: media.id,
      type: media.type as SharedMediaType,
      objectKey: media.objectKey,
      byteSize: Number(media.byteSize),
      contentType: media.contentType,
      encAlgo: media.encAlgo,
      encMeta: media.encMeta,

      thumbObjectKey: media.thumbObjectKey || undefined,
      thumbByteSize:
        media.thumbByteSize != null ? Number(media.thumbByteSize) : undefined,
      thumbContentType: media.thumbContentType || undefined,
      thumbEncMeta: media.thumbEncMeta || undefined,
      thumbUploadedAt: media.thumbUploadedAt || undefined,

      originalFilename: media.originalFilename || undefined,
      sha256Ciphertext: media.sha256Ciphertext
        ? media.sha256Ciphertext.toString("base64")
        : undefined,
      exifTakenAt: media.exifTakenAt || undefined,
      exifLat: media.exifLat || undefined,
      exifLng: media.exifLng || undefined,
      title: media.title || undefined,
      note: media.note || undefined,
      takenAt: media.takenAt || undefined,
      locationText: media.locationText || undefined,
      isTrashed: media.isTrashed,
      trashedAt: media.trashedAt || undefined,
      purgeAfter: media.purgeAfter || undefined,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
