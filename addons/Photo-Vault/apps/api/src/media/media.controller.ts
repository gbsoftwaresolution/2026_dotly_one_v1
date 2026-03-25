import {
  Controller,
  Post,
  Get,
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
  BadRequestException,
} from "@nestjs/common";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Throttle } from "@nestjs/throttler";
import { MediaService } from "./media.service";
import {
  UploadIntentDto,
  CompleteUploadDto,
  UpdateMediaDto,
  MediaResponse,
  PaginatedMediaResponse,
  SignedUploadUrlResponse,
  SignedDownloadUrlResponse,
  UploadIntentResponse,
  UploadThumbnailDto,
  MultipartUploadInitResponse,
  MultipartUploadSupport,
  MultipartUploadPartUrlResponse,
  MultipartUploadStatusResponse,
  MultipartCompleteRequest,
} from "@booster-vault/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";

@Controller("media")
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Create upload intent for a new media item
   */
  @Post("upload-intents")
  @Throttle({ upload: {} })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async createUploadIntent(
    @Request() req: ExpressRequest,
    @Body() uploadIntentDto: UploadIntentDto,
  ): Promise<UploadIntentResponse> {
    const userId = (req as any).user?.sub;
    const requestId = (req as any).requestId as string | undefined;
    return this.mediaService.createUploadIntent(
      userId,
      uploadIntentDto,
      requestId,
    );
  }

  /**
   * Complete upload after client has uploaded ciphertext
   */
  @Post(":mediaId/complete-upload")
  @Throttle({ upload: {} })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  async completeUpload(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Body() body: any,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const completeUploadDto: CompleteUploadDto = {
      etag: typeof body?.etag === "string" ? body.etag : undefined,
      sha256CiphertextB64:
        typeof body?.sha256CiphertextB64 === "string"
          ? body.sha256CiphertextB64
          : undefined,
      encMeta:
        body?.encMeta && typeof body.encMeta === "object" ? body.encMeta : undefined,
    };
    const media = await this.mediaService.completeUpload(
      userId,
      mediaId,
      completeUploadDto,
    );
    return { media };
  }

  /**
   * Create upload intent for an encrypted thumbnail (client-generated).
   */
  @Post(":mediaId/thumbnail-upload-intent")
  @Throttle({ upload: {} })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  async createThumbnailUploadIntent(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Body() thumbnail: UploadThumbnailDto,
  ): Promise<{
    media: MediaResponse;
    signedThumbnailUploadUrl: SignedUploadUrlResponse;
  }> {
    const userId = (req as any).user?.sub;
    const requestId = (req as any).requestId as string | undefined;
    const result = await this.mediaService.createThumbnailUploadIntent(
      userId,
      mediaId,
      thumbnail,
      requestId,
    );
    return result;
  }

  /**
   * Complete thumbnail upload after client has uploaded ciphertext.
   */
  @Post(":mediaId/complete-thumbnail-upload")
  @Throttle({ upload: {} })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  async completeThumbnailUpload(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Body() body: any,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const requestId = (req as any).requestId as string | undefined;
    const dto: CompleteUploadDto = {
      etag: typeof body?.etag === "string" ? body.etag : undefined,
    };
    const media = await this.mediaService.completeThumbnailUpload(
      userId,
      mediaId,
      dto,
      requestId,
    );
    return { media };
  }

  /**
   * List user's media with pagination
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listMedia(
    @Request() req: ExpressRequest,
    @Query("includeTrashed") includeTrashed?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("albumId") albumId?: string,
  ): Promise<{ media: PaginatedMediaResponse }> {
    const userId = (req as any).user?.sub;
    const media = await this.mediaService.listMedia(userId, {
      includeTrashed: includeTrashed === "true",
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      albumId,
    });
    return { media };
  }

  /**
   * Get server-side multipart upload support/capabilities.
   * Useful for clients to decide upload strategy before creating an upload intent.
   */
  @Get("multipart/support")
  @HttpCode(HttpStatus.OK)
  async getMultipartSupport(): Promise<{ multipart: MultipartUploadSupport }> {
    return { multipart: this.mediaService.getMultipartSupport() };
  }

  /**
   * Initialize S3 multipart upload for this media object.
   */
  @Post(":mediaId/multipart/init")
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.OK)
  async initMultipartUpload(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<{ multipart: MultipartUploadInitResponse }> {
    const userId = (req as any).user?.sub;
    const multipart = await this.mediaService.initMultipartUpload(
      userId,
      mediaId,
    );
    return { multipart };
  }

  /**
   * Get a presigned upload URL for one multipart part.
   */
  @Post(":mediaId/multipart/part-url")
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.OK)
  async getMultipartPartUrl(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("uploadId") uploadId: string,
    @Query("partNumber") partNumber: string,
  ): Promise<{ part: MultipartUploadPartUrlResponse }> {
    const userId = (req as any).user?.sub;
    if (!uploadId) throw new BadRequestException("uploadId is required");
    const parsedPartNumber = partNumber ? parseInt(partNumber, 10) : NaN;
    if (!Number.isFinite(parsedPartNumber)) {
      throw new BadRequestException("partNumber is required");
    }

    const part = await this.mediaService.getMultipartUploadPartUrl({
      userId,
      mediaId,
      uploadId,
      partNumber: parsedPartNumber,
    });
    return { part };
  }

  /**
   * List already-uploaded parts for resume.
   */
  @Get(":mediaId/multipart/status")
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.OK)
  async getMultipartStatus(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("uploadId") uploadId: string,
  ): Promise<{ status: MultipartUploadStatusResponse }> {
    const userId = (req as any).user?.sub;
    if (!uploadId) throw new BadRequestException("uploadId is required");
    const status = await this.mediaService.getMultipartUploadStatus({
      userId,
      mediaId,
      uploadId,
    });
    return { status };
  }

  /**
   * Complete a multipart upload once all parts are uploaded.
   */
  @Post(":mediaId/multipart/complete")
  @Throttle({ upload: {} })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  async completeMultipartUpload(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("uploadId") uploadId: string,
    @Body() body: MultipartCompleteRequest,
  ): Promise<{ result: { etag?: string } }> {
    const userId = (req as any).user?.sub;
    if (!uploadId) throw new BadRequestException("uploadId is required");
    const result = await this.mediaService.completeMultipartUpload({
      userId,
      mediaId,
      uploadId,
      body,
    });
    return { result };
  }

  /**
   * Abort a multipart upload.
   */
  @Post(":mediaId/multipart/abort")
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.OK)
  async abortMultipartUpload(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("uploadId") uploadId: string,
  ): Promise<{ ok: true }> {
    const userId = (req as any).user?.sub;
    if (!uploadId) throw new BadRequestException("uploadId is required");
    await this.mediaService.abortMultipartUpload({
      userId,
      mediaId,
      uploadId,
    });
    return { ok: true };
  }

  /**
   * Get a single media item
   */
  @Get(":mediaId")
  @HttpCode(HttpStatus.OK)
  async getMedia(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const media = await this.mediaService.getMedia(userId, mediaId);
    return { media };
  }

  /**
   * Update media metadata
   */
  @Patch(":mediaId")
  @HttpCode(HttpStatus.OK)
  async updateMedia(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Body() updateMediaDto: UpdateMediaDto,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const media = await this.mediaService.updateMedia(
      userId,
      mediaId,
      updateMediaDto,
    );
    return { media };
  }

  /**
   * Move media to trash
   */
  @Delete(":mediaId")
  @HttpCode(HttpStatus.OK)
  async trashMedia(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const media = await this.mediaService.trashMedia(userId, mediaId);
    return { media };
  }

  /**
   * Restore media from trash
   */
  @Post(":mediaId/restore")
  @HttpCode(HttpStatus.OK)
  async restoreMedia(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<{ media: MediaResponse }> {
    const userId = (req as any).user?.sub;
    const media = await this.mediaService.restoreMedia(userId, mediaId);
    return { media };
  }

  /**
   * Permanently delete (purge) media
   */
  @Post(":mediaId/purge")
  @HttpCode(HttpStatus.NO_CONTENT)
  async purgeMedia(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.mediaService.purgeMedia(userId, mediaId);
  }

  /**
   * Get signed download URL for a media item
   */
  @Post(":mediaId/download-url")
  @HttpCode(HttpStatus.OK)
  async getDownloadUrl(
    @Request() req: ExpressRequest,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("variant") variant?: string,
  ): Promise<{ downloadUrl: SignedDownloadUrlResponse }> {
    const userId = (req as any).user?.sub;
    const downloadUrl = await this.mediaService.getDownloadUrl(
      userId,
      mediaId,
      variant,
    );
    return { downloadUrl };
  }
}
