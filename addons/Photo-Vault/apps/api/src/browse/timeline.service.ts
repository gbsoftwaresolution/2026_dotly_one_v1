import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  TimelineQueryDto,
  BrowsePaginatedMediaResponse,
  MediaResponse,
} from "@booster-vault/shared";
import { MediaType as SharedMediaType } from "@booster-vault/shared";

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get timeline of user's media with optional filters
   */
  async getTimeline(
    userId: string,
    query: TimelineQueryDto,
  ): Promise<BrowsePaginatedMediaResponse> {
    const limit = Math.min(query.limit || 50, 200);
    const { year, albumId, cursor } = query;

    // Validate album if provided
    if (albumId) {
      await this.validateAlbum(userId, albumId);
    }

    const items = await this.getTimelineItemsRaw(
      userId,
      year,
      albumId,
      cursor,
      limit + 1, // Fetch one extra to check for next page
    );

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore
      ? this.encodeCursor(resultItems[resultItems.length - 1])
      : undefined;

    return {
      items: resultItems.map((item) => this.mapMediaToResponse(item)),
      pagination: {
        limit,
        cursor: cursor || undefined,
        nextCursor,
      },
    };
  }

  /**
   * Raw SQL query to get timeline items with proper ordering and cursor
   */
  private async getTimelineItemsRaw(
    userId: string,
    year: number | undefined,
    albumId: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<any[]> {
    // Decode cursor if present
    let cursorTakenAt: Date | null = null;
    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const decoded = this.decodeCursor(cursor);
        cursorTakenAt = decoded.takenAtOrCreatedAt;
        cursorCreatedAt = decoded.createdAt;
        cursorId = decoded.id;
      } catch (error) {
        throw new BadRequestException("Invalid cursor");
      }
    }

    // Build SQL query parts
    const sqlParts: string[] = [];
    const sqlValues: any[] = [userId];

    sqlParts.push(`
      SELECT m.* 
      FROM media m
      ${albumId ? 'INNER JOIN album_items ai ON m.id = ai."mediaId"' : ""}
      WHERE m."userId" = $1
      AND m."isTrashed" = false
    `);

    let paramIndex = 2;

    // Add album filter
    if (albumId) {
      sqlValues.push(albumId);
      sqlParts.push(` AND ai."albumId" = $${paramIndex++}`);
    }

    // Add year filter
    if (year !== undefined) {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
      sqlValues.push(yearStart, yearEnd);
      sqlParts.push(` AND (
        (m."takenAt" >= $${paramIndex} AND m."takenAt" < $${paramIndex + 1})
        OR (m."takenAt" IS NULL AND m."createdAt" >= $${paramIndex} AND m."createdAt" < $${paramIndex + 1})
      )`);
      paramIndex += 2;
    }

    // Add cursor condition
    if (cursorTakenAt && cursorCreatedAt && cursorId) {
      sqlValues.push(cursorTakenAt, cursorCreatedAt, cursorId);
      sqlParts.push(` AND (
        COALESCE(m."takenAt", m."createdAt") < $${paramIndex}
        OR (COALESCE(m."takenAt", m."createdAt") = $${paramIndex} AND m."createdAt" < $${paramIndex + 1})
        OR (COALESCE(m."takenAt", m."createdAt") = $${paramIndex} AND m."createdAt" = $${paramIndex + 1} AND m.id < $${paramIndex + 2})
      )`);
      paramIndex += 3;
    }

    // Ordering
    sqlParts.push(
      ` ORDER BY COALESCE(m."takenAt", m."createdAt") DESC, m."createdAt" DESC, m.id DESC`,
    );

    // Limit
    sqlValues.push(limit);
    sqlParts.push(` LIMIT $${paramIndex}`);

    const sql = sqlParts.join("");

    // Execute placeholder-based SQL with bound parameters.
    // We build the SQL string (structure only) and pass user-provided values separately.
    return this.prisma.$queryRawUnsafe(sql, ...sqlValues);
  }

  /**
   * Validate album belongs to user and is not deleted
   */
  private async validateAlbum(userId: string, albumId: string): Promise<void> {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      throw new NotFoundException("Album not found");
    }

    if (album.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this album");
    }

    if (album.isDeleted) {
      throw new BadRequestException("Album is deleted");
    }
  }

  /**
   * Encode cursor from last item
   */
  private encodeCursor(item: any): string {
    const takenAtOrCreatedAt =
      item.taken_at ?? item.takenAt ?? item.created_at ?? item.createdAt;
    const createdAt = item.created_at ?? item.createdAt;
    const cursorData = {
      t: takenAtOrCreatedAt.toISOString(),
      c: createdAt.toISOString(),
      i: item.id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString("base64");
  }

  /**
   * Decode cursor to tuple
   */
  private decodeCursor(cursor: string): {
    takenAtOrCreatedAt: Date;
    createdAt: Date;
    id: string;
  } {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
    return {
      takenAtOrCreatedAt: new Date(decoded.t),
      createdAt: new Date(decoded.c),
      id: decoded.i,
    };
  }

  /**
   * Map database row to MediaResponse
   */
  private mapMediaToResponse(row: any): MediaResponse {
    return {
      id: row.id,
      type: row.type as SharedMediaType,
      objectKey: row.object_key ?? row.objectKey,
      byteSize: Number(row.byte_size ?? row.byteSize),
      contentType: row.content_type ?? row.contentType,
      encAlgo: row.enc_algo ?? row.encAlgo,
      encMeta: row.enc_meta ?? row.encMeta,

      thumbObjectKey: row.thumb_object_key ?? row.thumbObjectKey ?? undefined,
      thumbByteSize:
        (row.thumb_byte_size ?? row.thumbByteSize) != null
          ? Number(row.thumb_byte_size ?? row.thumbByteSize)
          : undefined,
      thumbContentType:
        row.thumb_content_type ?? row.thumbContentType ?? undefined,
      thumbEncMeta: row.thumb_enc_meta ?? row.thumbEncMeta ?? undefined,
      thumbUploadedAt:
        row.thumb_uploaded_at ?? row.thumbUploadedAt ?? undefined,

      originalFilename:
        row.original_filename ?? row.originalFilename ?? undefined,
      sha256Ciphertext:
        (row.sha256_ciphertext ?? row.sha256Ciphertext)
          ? (row.sha256_ciphertext ?? row.sha256Ciphertext).toString("base64")
          : undefined,
      exifTakenAt: row.exif_taken_at ?? row.exifTakenAt ?? undefined,
      exifLat: row.exif_lat ?? row.exifLat ?? undefined,
      exifLng: row.exif_lng ?? row.exifLng ?? undefined,
      title: row.title || undefined,
      note: row.note || undefined,
      takenAt: row.taken_at ?? row.takenAt ?? undefined,
      locationText: row.location_text ?? row.locationText ?? undefined,
      isTrashed: row.is_trashed ?? row.isTrashed,
      trashedAt: row.trashed_at ?? row.trashedAt ?? undefined,
      purgeAfter: row.purge_after ?? row.purgeAfter ?? undefined,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt,
    };
  }
}
