import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
} from "@nestjs/common";
import { TimelineService } from "./timeline.service";
import { SearchService } from "./search.service";
import {
  TimelineQueryDto,
  SearchQueryDto,
  BrowsePaginatedMediaResponse,
} from "@booster-vault/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import { isUUID } from "class-validator";

@Controller()
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard)
export class BrowseController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * GET /v1/timeline
   * Get timeline of user's media with optional filters
   */
  @Get("timeline")
  @HttpCode(HttpStatus.OK)
  async getTimeline(
    @Request() req: ExpressRequest,
    @Query("year") year?: string | number,
    @Query("albumId") albumId?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ timeline: BrowsePaginatedMediaResponse }> {
    const userId = (req as any).user?.sub;

    const yearNumber = parseOptionalInt(year, "year");
    const albumIdUuid = parseOptionalUuid(albumId, "albumId");

    // Validate limit
    let limitNumber: number | undefined;
    if (limit) {
      limitNumber = parseInt(limit, 10);
      if (isNaN(limitNumber) || limitNumber < 1) {
        throw new BadRequestException("limit must be a positive integer");
      }
      if (limitNumber > 200) {
        throw new BadRequestException("limit cannot exceed 200");
      }
    }

    const query: TimelineQueryDto = {
      year: yearNumber,
      albumId: albumIdUuid,
      limit: limitNumber,
      cursor,
    };

    const timeline = await this.timelineService.getTimeline(userId, query);
    return { timeline };
  }

  /**
   * GET /v1/search
   * Search user's media with full-text search
   */
  @Get("search")
  @HttpCode(HttpStatus.OK)
  async search(
    @Request() req: ExpressRequest,
    @Query("q") q: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("albumId") albumId?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ search: BrowsePaginatedMediaResponse }> {
    const userId = (req as any).user?.sub;

    const albumIdUuid = parseOptionalUuid(albumId, "albumId");

    // Validate required query
    if (!q || q.trim().length < 1) {
      throw new BadRequestException(
        "q (query) is required and must be at least 1 character",
      );
    }

    // Parse dates
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        throw new BadRequestException("from must be a valid ISO date string");
      }
    }

    if (to) {
      toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        throw new BadRequestException("to must be a valid ISO date string");
      }
    }

    // Validate limit
    let limitNumber: number | undefined;
    if (limit) {
      limitNumber = parseInt(limit, 10);
      if (isNaN(limitNumber) || limitNumber < 1) {
        throw new BadRequestException("limit must be a positive integer");
      }
      if (limitNumber > 200) {
        throw new BadRequestException("limit cannot exceed 200");
      }
    }

    const query: SearchQueryDto = {
      q: q.trim(),
      from: fromDate,
      to: toDate,
      albumId: albumIdUuid,
      limit: limitNumber,
      cursor,
    };

    const search = await this.searchService.search(userId, query);
    return { search };
  }
}

function parseOptionalInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${name} must be a valid integer`);
    }
    return Math.trunc(value);
  }

  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException(`${name} must be a valid integer`);
  }
  return parsed;
}

function parseOptionalUuid(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const str = String(value);
  if (!isUUID(str)) {
    throw new BadRequestException(`${name} must be a valid UUID`);
  }
  return str;
}
