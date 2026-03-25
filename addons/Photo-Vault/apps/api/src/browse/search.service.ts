import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  SearchQueryDto,
  BrowsePaginatedMediaResponse,
  MediaResponse,
} from "@booster-vault/shared";
import { MediaType as SharedMediaType } from "@booster-vault/shared";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search user's media with full-text search
   */
  async search(
    userId: string,
    query: SearchQueryDto,
  ): Promise<BrowsePaginatedMediaResponse> {
    const limit = Math.min(query.limit || 50, 200);
    const { q, from, to, albumId, cursor } = query;

    // Validate query
    const trimmedQ = q.trim();
    if (trimmedQ.length < 1) {
      throw new BadRequestException(
        "Search query must be at least 1 character",
      );
    }

    // Validate album if provided
    if (albumId) {
      await this.validateAlbum(userId, albumId);
    }

    // Perform search with raw SQL for full-text search
    const items = await this.searchItemsRaw(
      userId,
      trimmedQ,
      from,
      to,
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
   * Search using CTE for clean cursor handling and full-text search
   */
  private async searchItemsRaw(
    userId: string,
    query: string,
    from: Date | undefined,
    to: Date | undefined,
    albumId: string | undefined,
    cursor: string | undefined,
    limit: number,
  ): Promise<any[]> {
    const searchQuery = this.buildTsQuery(query);

    // Decode cursor if present
    let cursorCondition = "";
    const params: any[] = [userId, searchQuery];

    if (cursor) {
      try {
        const decoded = this.decodeCursor(cursor);
        params.push(
          decoded.rank,
          decoded.takenAtOrCreatedAt,
          decoded.createdAt,
          decoded.id,
        );
        cursorCondition = `AND (
          r.rank < $3
          OR (r.rank = $3 AND r.taken_at_or_created < $4)
          OR (r.rank = $3 AND r.taken_at_or_created = $4 AND r."createdAt" < $5)
          OR (r.rank = $3 AND r.taken_at_or_created = $4 AND r."createdAt" = $5 AND r.id < $6)
        )`;
      } catch (error) {
        throw new BadRequestException("Invalid cursor");
      }
    }

    let sql = `
      WITH search_results AS (
        SELECT 
          m.*,
          ts_rank(m.search_tsv, to_tsquery('simple', $2)) as rank,
          COALESCE(m."takenAt", m."createdAt") as taken_at_or_created
        FROM media m
        ${albumId ? 'INNER JOIN album_items ai ON m.id = ai."mediaId"' : ""}
        ${
          !albumId
            ? `
          LEFT JOIN albums a ON a."userId" = m."userId" AND a."isDeleted" = false
          LEFT JOIN album_items ai2 ON a.id = ai2."albumId" AND ai2."mediaId" = m.id
        `
            : ""
        }
        WHERE m."userId" = $1
        AND m."isTrashed" = false
        AND (
          m.search_tsv @@ to_tsquery('simple', $2)
          ${!albumId ? `OR (a.id IS NOT NULL AND to_tsvector('simple', a.name) @@ to_tsquery('simple', $2))` : ""}
        )
    `;

    if (albumId) {
      params.push(albumId);
      sql += ` AND ai."albumId" = $${params.length}`;
    }

    if (from) {
      params.push(from);
      sql += ` AND COALESCE(m."takenAt", m."createdAt") >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      sql += ` AND COALESCE(m."takenAt", m."createdAt") < $${params.length}`;
    }

    sql += `
        GROUP BY m.id
      ),
      ranked_results AS (
        SELECT * FROM search_results
        WHERE 1=1 ${cursorCondition}
        ORDER BY rank DESC, taken_at_or_created DESC, "createdAt" DESC, id DESC
        LIMIT $${params.length + 1}
      )
      SELECT * FROM ranked_results
    `;

    params.push(limit);

    // Execute placeholder-based SQL with bound parameters.
    // We build the SQL string (structure only) and pass user-provided values separately.
    return this.prisma.$queryRawUnsafe(sql, ...params);
  }

  /**
   * Build tsquery from user query
   */
  private buildTsQuery(query: string): string {
    // Simple implementation: split by spaces, join with &
    const terms = query
      .trim()
      .split(/\s+/)
      .map((term) => term.replace(/[^\w]/g, "")) // Remove non-word chars
      .filter((term) => term.length > 0)
      .map((term) => `${term}:*`); // Prefix search

    return terms.join(" & ") || ":*"; // Default to match all if empty
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
      r: item.rank,
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
    rank: number;
    takenAtOrCreatedAt: Date;
    createdAt: Date;
    id: string;
  } {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
    return {
      rank: decoded.r,
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
