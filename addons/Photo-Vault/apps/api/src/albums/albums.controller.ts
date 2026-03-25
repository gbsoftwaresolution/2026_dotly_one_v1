import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseUUIDPipe,
} from "@nestjs/common";
import { AlbumsService } from "./albums.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import {
  CreateAlbumDto,
  UpdateAlbumDto,
  AddItemsDto,
  ReorderItemsDto,
  AlbumResponse,
  PaginatedAlbumResponse,
  PaginatedAlbumItemsResponse,
} from "@booster-vault/shared";

@Controller("albums")
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard)
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  /**
   * List user's albums
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listAlbums(
    @Request() req: ExpressRequest,
    @Query("includeDeleted") includeDeleted?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ albums: PaginatedAlbumResponse }> {
    const userId = (req as any).user?.sub;
    const albums = await this.albumsService.listAlbums(userId, {
      includeDeleted: includeDeleted === "true",
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
    return { albums };
  }

  /**
   * Create a new album
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAlbum(
    @Request() req: ExpressRequest,
    @Body() createAlbumDto: CreateAlbumDto,
  ): Promise<{ album: AlbumResponse }> {
    const userId = (req as any).user?.sub;
    const album = await this.albumsService.createAlbum(userId, createAlbumDto);
    return { album };
  }

  /**
   * Get a single album
   */
  @Get(":albumId")
  @HttpCode(HttpStatus.OK)
  async getAlbum(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
  ): Promise<{ album: AlbumResponse }> {
    const userId = (req as any).user?.sub;
    const album = await this.albumsService.getAlbum(userId, albumId);
    return { album };
  }

  /**
   * Update an album
   */
  @Patch(":albumId")
  @HttpCode(HttpStatus.OK)
  async updateAlbum(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Body() updateAlbumDto: UpdateAlbumDto,
  ): Promise<{ album: AlbumResponse }> {
    const userId = (req as any).user?.sub;
    const album = await this.albumsService.updateAlbum(
      userId,
      albumId,
      updateAlbumDto,
    );
    return { album };
  }

  /**
   * Delete an album (soft delete)
   */
  @Delete(":albumId")
  @HttpCode(HttpStatus.OK)
  async deleteAlbum(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
  ): Promise<{ album: AlbumResponse }> {
    const userId = (req as any).user?.sub;
    const album = await this.albumsService.deleteAlbum(userId, albumId);
    return { album };
  }

  /**
   * List album items
   */
  @Get(":albumId/items")
  @HttpCode(HttpStatus.OK)
  async listAlbumItems(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Query("includeTrashed") includeTrashed?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ items: PaginatedAlbumItemsResponse }> {
    const userId = (req as any).user?.sub;
    const items = await this.albumsService.listAlbumItems(userId, albumId, {
      includeTrashed: includeTrashed === "true",
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
    return { items };
  }

  /**
   * Add media items to an album
   */
  @Post(":albumId/items")
  @HttpCode(HttpStatus.NO_CONTENT)
  async addItemsToAlbum(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Body() addItemsDto: AddItemsDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.albumsService.addItemsToAlbum(userId, albumId, addItemsDto);
  }

  /**
   * Remove a media item from an album
   */
  @Delete(":albumId/items")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItemFromAlbum(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Query("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.albumsService.removeItemFromAlbum(userId, albumId, mediaId);
  }

  /**
   * Reorder items in an album
   */
  @Post(":albumId/items/reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderAlbumItems(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Body() reorderItemsDto: ReorderItemsDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.albumsService.reorderAlbumItems(
      userId,
      albumId,
      reorderItemsDto,
    );
  }
}
