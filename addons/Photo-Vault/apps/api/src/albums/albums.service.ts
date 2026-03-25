import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAlbumDto,
  UpdateAlbumDto,
  AddItemsDto,
  ReorderItemsDto,
  AlbumResponse,
  PaginatedAlbumResponse,
  PaginatedAlbumItemsResponse,
  AlbumItemResponse,
} from "@booster-vault/shared";

@Injectable()
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List user's albums with pagination
   */
  async listAlbums(
    userId: string,
    options: {
      includeDeleted?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<PaginatedAlbumResponse> {
    const { includeDeleted = false, limit = 50, cursor } = options;

    const where: any = {
      userId,
      ...(!includeDeleted && { isDeleted: false }),
      ...(cursor && { id: { lt: cursor } }), // cursor pagination by id
    };

    const albums = await this.prisma.album.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit + 1, // Fetch one extra to check if there's more
    });

    const hasMore = albums.length > limit;
    const items = hasMore ? albums.slice(0, limit) : albums;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
      items: items.map((album) => this.mapAlbumToResponse(album)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Create a new album
   */
  async createAlbum(
    userId: string,
    dto: CreateAlbumDto,
  ): Promise<AlbumResponse> {
    // Validate cover media if provided
    if (dto.coverMediaId) {
      await this.validateCoverMedia(userId, dto.coverMediaId);
    }

    const album = await this.prisma.$transaction(async (tx) => {
      const album = await tx.album.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          coverMediaId: dto.coverMediaId,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "ALBUM_CREATED",
          entityType: "ALBUM",
          entityId: album.id,
          meta: { name: dto.name },
        },
      });

      return album;
    });

    return this.mapAlbumToResponse(album);
  }

  /**
   * Get a single album
   */
  async getAlbum(userId: string, albumId: string): Promise<AlbumResponse> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this album");
    }

    return this.mapAlbumToResponse(album);
  }

  /**
   * Update an album
   */
  async updateAlbum(
    userId: string,
    albumId: string,
    dto: UpdateAlbumDto,
  ): Promise<AlbumResponse> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this album");
    }

    // Validate cover media if provided
    if (dto.coverMediaId !== undefined) {
      if (dto.coverMediaId === null) {
        // Clear cover
      } else {
        await this.validateCoverMedia(userId, dto.coverMediaId);
      }
    }

    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data: {
        name: dto.name,
        description: dto.description,
        coverMediaId: dto.coverMediaId,
        updatedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "ALBUM_UPDATED",
        entityType: "ALBUM",
        entityId: albumId,
        meta: {
          name: dto.name,
          description: dto.description,
          coverMediaId: dto.coverMediaId,
        },
      },
    });

    return this.mapAlbumToResponse(updated);
  }

  /**
   * Soft delete an album
   */
  async deleteAlbum(userId: string, albumId: string): Promise<AlbumResponse> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to delete this album");
    }

    if (album.isDeleted) {
      throw new BadRequestException("Album is already deleted");
    }

    const deletedAt = new Date();
    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data: {
        isDeleted: true,
        deletedAt,
        updatedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "ALBUM_DELETED",
        entityType: "ALBUM",
        entityId: albumId,
        meta: { deletedAt },
      },
    });

    return this.mapAlbumToResponse(updated);
  }

  /**
   * List album items with pagination
   */
  async listAlbumItems(
    userId: string,
    albumId: string,
    options: {
      includeTrashed?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<PaginatedAlbumItemsResponse> {
    const { includeTrashed = false, limit = 50, cursor } = options;

    // Verify album ownership
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this album");
    }

    // Build where clause for album items
    const where: any = {
      albumId,
      userId,
      ...(!includeTrashed && {
        media: {
          isTrashed: false,
        },
      }),
    };

    // Cursor pagination based on (position, mediaId)
    let cursorWhere = {};
    if (cursor) {
      // cursor format: "position,mediaId"
      const [positionStr, mediaId] = cursor.split(",");
      if (!positionStr || !mediaId) {
        throw new BadRequestException("Invalid cursor");
      }

      const position = BigInt(positionStr);
      cursorWhere = {
        OR: [
          { position: { gt: position } },
          { position, mediaId: { gt: mediaId } },
        ],
      };
    }

    const albumItems = await this.prisma.albumItem.findMany({
      where: { ...where, ...cursorWhere },
      include: {
        media: true,
      },
      orderBy: [{ position: "asc" }, { mediaId: "asc" }],
      take: limit + 1,
    });

    const hasMore = albumItems.length > limit;
    const items = hasMore ? albumItems.slice(0, limit) : albumItems;
    const lastItem = items.at(-1);
    const nextCursor =
      hasMore && lastItem
        ? `${lastItem.position},${lastItem.mediaId}`
        : undefined;

    return {
      items: items.map((item) => this.mapAlbumItemToResponse(item)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Add media items to an album
   */
  async addItemsToAlbum(
    userId: string,
    albumId: string,
    dto: AddItemsDto,
  ): Promise<void> {
    // Verify album ownership
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to modify this album");
    }

    // Check if album is deleted
    if (album.isDeleted) {
      throw new BadRequestException("Cannot add items to a deleted album");
    }

    // Validate all media IDs belong to user and are not trashed
    const mediaRecords = await this.prisma.media.findMany({
      where: {
        id: { in: dto.mediaIds },
        userId,
      },
    });

    const validMediaIds = new Set(mediaRecords.map((m) => m.id));
    const trashedMediaIds = mediaRecords
      .filter((m) => m.isTrashed)
      .map((m) => m.id);

    // Check for invalid media IDs
    const invalidIds = dto.mediaIds.filter((id) => !validMediaIds.has(id));
    if (invalidIds.length > 0) {
      throw new ForbiddenException(
        `Some media items do not exist or do not belong to you: ${invalidIds.join(", ")}`,
      );
    }

    // Check for trashed media IDs
    if (trashedMediaIds.length > 0) {
      throw new UnprocessableEntityException({
        message: "Cannot add trashed media to album",
        invalidIds: trashedMediaIds,
      });
    }

    // Get current max position in album
    const maxPositionResult = await this.prisma.albumItem.aggregate({
      where: { albumId },
      _max: { position: true },
    });
    const maxPosition = maxPositionResult._max.position || BigInt(0);

    // Prepare items to create (ignore duplicates)
    const existingItems = await this.prisma.albumItem.findMany({
      where: {
        albumId,
        mediaId: { in: dto.mediaIds },
      },
      select: { mediaId: true },
    });
    const existingMediaIds = new Set(existingItems.map((item) => item.mediaId));
    const newMediaIds = dto.mediaIds.filter((id) => !existingMediaIds.has(id));

    if (newMediaIds.length === 0) {
      return; // All items already exist in album
    }

    // Create items with incremental positions (max+1000, max+2000, ...)
    await this.prisma.$transaction(async (tx) => {
      const itemsToCreate = newMediaIds.map((mediaId, index) => ({
        albumId,
        mediaId,
        userId,
        position: maxPosition + BigInt((index + 1) * 1000),
      }));

      await tx.albumItem.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "ALBUM_ITEMS_ADDED",
          entityType: "ALBUM",
          entityId: albumId,
          meta: { addedCount: newMediaIds.length, mediaIds: newMediaIds },
        },
      });
    });
  }

  /**
   * Remove a media item from an album
   */
  async removeItemFromAlbum(
    userId: string,
    albumId: string,
    mediaId: string,
  ): Promise<void> {
    // Verify album ownership
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to modify this album");
    }

    // Delete the album item
    const result = await this.prisma.albumItem.deleteMany({
      where: {
        albumId,
        mediaId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Media item not found in album");
    }

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "ALBUM_ITEM_REMOVED",
        entityType: "ALBUM",
        entityId: albumId,
        meta: { mediaId },
      },
    });
  }

  /**
   * Reorder items in an album
   */
  async reorderAlbumItems(
    userId: string,
    albumId: string,
    dto: ReorderItemsDto,
  ): Promise<void> {
    // Verify album ownership
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to modify this album");
    }

    // Check if album is deleted
    if (album.isDeleted) {
      throw new BadRequestException("Cannot reorder items in a deleted album");
    }

    // Verify all media IDs are in the album
    const albumItems = await this.prisma.albumItem.findMany({
      where: {
        albumId,
        mediaId: { in: dto.items.map((item) => item.mediaId) },
      },
      select: { mediaId: true },
    });

    const albumMediaIds = new Set(albumItems.map((item) => item.mediaId));
    const invalidMediaIds = dto.items
      .filter((item) => !albumMediaIds.has(item.mediaId))
      .map((item) => item.mediaId);

    if (invalidMediaIds.length > 0) {
      throw new BadRequestException(
        `Some media items are not in the album: ${invalidMediaIds.join(", ")}`,
      );
    }

    // Update positions in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.albumItem.update({
          where: {
            albumId_mediaId: {
              albumId,
              mediaId: item.mediaId,
            },
          },
          data: {
            position: BigInt(item.position),
          },
        });
      }

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "ALBUM_ITEMS_REORDERED",
          entityType: "ALBUM",
          entityId: albumId,
          meta: { reorderedCount: dto.items.length },
        },
      });
    });
  }

  /**
   * Validate that a media item can be used as album cover
   */
  private async validateCoverMedia(
    userId: string,
    mediaId: string,
  ): Promise<void> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException("Cover media not found");
    }

    if (media.userId !== userId) {
      throw new ForbiddenException("Cover media does not belong to you");
    }

    if (media.isTrashed) {
      throw new BadRequestException("Cannot use trashed media as album cover");
    }
  }

  /**
   * Map Prisma Album to API response
   */
  private mapAlbumToResponse(album: any): AlbumResponse {
    return {
      id: album.id,
      name: album.name,
      description: album.description || undefined,
      coverMediaId: album.coverMediaId || undefined,
      isDeleted: album.isDeleted,
      deletedAt: album.deletedAt || undefined,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };
  }

  /**
   * Map Prisma AlbumItem to API response
   */
  private mapAlbumItemToResponse(albumItem: any): AlbumItemResponse {
    return {
      media: {
        id: albumItem.media.id,
        type: albumItem.media.type,
        objectKey: albumItem.media.objectKey,
        byteSize: Number(albumItem.media.byteSize),
        contentType: albumItem.media.contentType,
        encAlgo: albumItem.media.encAlgo,
        encMeta: albumItem.media.encMeta,
        originalFilename: albumItem.media.originalFilename || undefined,
        sha256Ciphertext: albumItem.media.sha256Ciphertext
          ? albumItem.media.sha256Ciphertext.toString("base64")
          : undefined,
        exifTakenAt: albumItem.media.exifTakenAt || undefined,
        exifLat: albumItem.media.exifLat || undefined,
        exifLng: albumItem.media.exifLng || undefined,
        title: albumItem.media.title || undefined,
        note: albumItem.media.note || undefined,
        takenAt: albumItem.media.takenAt || undefined,
        locationText: albumItem.media.locationText || undefined,
        isTrashed: albumItem.media.isTrashed,
        trashedAt: albumItem.media.trashedAt || undefined,
        purgeAfter: albumItem.media.purgeAfter || undefined,
        createdAt: albumItem.media.createdAt,
        updatedAt: albumItem.media.updatedAt,
      },
      position: Number(albumItem.position),
      addedAt: albumItem.addedAt,
    };
  }
}
