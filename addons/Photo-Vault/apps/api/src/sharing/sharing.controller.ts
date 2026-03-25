import {
  Controller,
  Get,
  Post,
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
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SharingService } from "./sharing.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import {
  CreateShareRequestDto,
  CreateShareStubRequestDto,
  CreateShareResponse,
  SharedAlbumMetadataResponse,
  EncryptedShareBundleResponse,
  UnlockShareDto,
  SharedMediaDownloadUrlResponse,
  SharedMediaMetadataListResponse,
  UploadShareBundleDto,
  ShareAnalyticsResponse,
} from "@booster-vault/shared";

@Controller("share")
@UseInterceptors(ClassSerializerInterceptor)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  /**
   * Create a share for an album (owner only)
   */
  @Post("albums/:albumId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createShare(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Body() createShareRequestDto: CreateShareRequestDto,
  ): Promise<{ share: CreateShareResponse }> {
    const userId = (req as any).user?.sub;

    // Convert base64 strings to Buffers
    const encryptedAlbumKey = Buffer.from(
      createShareRequestDto.encryptedAlbumKey,
      "base64",
    );
    const iv = Buffer.from(createShareRequestDto.iv, "base64");

    // Map encrypted media keys
    const encryptedMediaKeys = createShareRequestDto.encryptedMediaKeys.map(
      (item) => ({
        mediaId: item.mediaId,
        encryptedKey: item.encryptedKey, // Keep as base64 string
        iv: item.iv,
      }),
    );

    const share = await this.sharingService.createShare(
      userId,
      albumId,
      createShareRequestDto.createShareDto,
      encryptedAlbumKey,
      encryptedMediaKeys,
      iv,
      createShareRequestDto.kdfParams,
    );

    return { share };
  }

  /**
   * Create a share stub for an album (owner only)
   *
   * Intended for large albums: create the share record first, then upload the encrypted bundle separately.
   */
  @Post("albums/:albumId/stub")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createShareStub(
    @Request() req: ExpressRequest,
    @Param("albumId", ParseUUIDPipe) albumId: string,
    @Body() body: CreateShareStubRequestDto,
  ): Promise<{ share: CreateShareResponse }> {
    const userId = (req as any).user?.sub;

    const share = await this.sharingService.createShareStub(
      userId,
      albumId,
      body?.createShareDto,
    );

    return { share };
  }

  /**
   * Upload encrypted share bundle (owner only)
   */
  @Post(":shareId/bundle")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async uploadShareBundle(
    @Request() req: ExpressRequest,
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @Body() bundle: UploadShareBundleDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;

    const encryptedAlbumKey = Buffer.from(bundle.encryptedAlbumKey, "base64");
    const iv = Buffer.from(bundle.iv, "base64");
    const encryptedMediaKeys = bundle.encryptedMediaKeys.map((item) => ({
      mediaId: item.mediaId,
      encryptedKey: item.encryptedKey,
      iv: item.iv,
    }));

    await this.sharingService.uploadShareBundle(
      userId,
      shareId,
      encryptedAlbumKey,
      encryptedMediaKeys,
      iv,
      bundle.kdfParams,
    );
  }

  /**
   * Get share metadata (public endpoint)
   */
  @Get(":shareId")
  @Throttle({ "share-public": {} })
  @HttpCode(HttpStatus.OK)
  async getShareMetadata(
    @Param("shareId", ParseUUIDPipe) shareId: string,
  ): Promise<{ share: SharedAlbumMetadataResponse }> {
    const share = await this.sharingService.getShareMetadata(shareId);
    return { share };
  }

  /**
   * List shared media metadata (public endpoint; requires X-Share-Token)
   */
  @Get(":shareId/media")
  @Throttle({ "share-public": {} })
  @HttpCode(HttpStatus.OK)
  async listSharedMediaMetadata(
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @Headers("X-Share-Token") shareToken: string,
    @Query("cursor") cursor: string | undefined,
    @Query("limit") limit: string | undefined,
  ): Promise<{ media: SharedMediaMetadataListResponse }> {
    if (!shareToken) {
      throw new UnauthorizedException("Missing X-Share-Token header");
    }

    const parsedCursor = cursor != null ? Number(cursor) : undefined;
    const parsedLimit = limit != null ? Number(limit) : undefined;

    const media = await this.sharingService.listSharedMediaMetadata(
      shareId,
      shareToken,
      Number.isFinite(parsedCursor) ? parsedCursor : undefined,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );

    return { media };
  }

  /**
   * Track a successful share view (public; requires X-Share-Token).
   */
  @Post(":shareId/view")
  @Throttle({ "share-public": {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackShareView(
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @Headers("X-Share-Token") shareToken: string,
  ): Promise<void> {
    if (!shareToken) {
      throw new UnauthorizedException("Missing X-Share-Token header");
    }

    await this.sharingService.trackShareView(shareId, shareToken);
  }

  /**
   * Unlock share with passphrase (public endpoint)
   */
  @Post(":shareId/unlock")
  @Throttle({ "share-public": {} })
  @HttpCode(HttpStatus.OK)
  async unlockShare(
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @Body() unlockShareDto: UnlockShareDto,
  ): Promise<{ bundle: EncryptedShareBundleResponse }> {
    const bundle = await this.sharingService.unlockShare(
      shareId,
      unlockShareDto,
    );
    return { bundle };
  }

  /**
   * Revoke a share (owner only)
   */
  @Post(":shareId/revoke")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShare(
    @Request() req: ExpressRequest,
    @Param("shareId", ParseUUIDPipe) shareId: string,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.sharingService.revokeShare(userId, shareId);
  }

  /**
   * Get share analytics (owner only)
   */
  @Get(":shareId/analytics")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getShareAnalytics(
    @Request() req: ExpressRequest,
    @Param("shareId", ParseUUIDPipe) shareId: string,
  ): Promise<{ analytics: ShareAnalyticsResponse }> {
    const userId = (req as any).user?.sub;
    const analytics = await this.sharingService.getShareAnalytics(
      userId,
      shareId,
    );
    return { analytics };
  }

  /**
   * List user's active shares
   */
  @Get("albums/active")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listUserShares(
    @Request() req: ExpressRequest,
  ): Promise<{ shares: any[] }> {
    const userId = (req as any).user?.sub;
    const shares = await this.sharingService.listUserShares(userId);
    return { shares };
  }

  /**
   * Get signed download URL for shared media (public endpoint, requires X-Share-Token header)
   */
  @Post(":shareId/media/:mediaId/download-url")
  @Throttle({ "share-public": {} })
  @HttpCode(HttpStatus.OK)
  async getSharedMediaDownloadUrl(
    @Param("shareId", ParseUUIDPipe) shareId: string,
    @Param("mediaId", ParseUUIDPipe) mediaId: string,
    @Query("variant") variant: string | undefined,
    @Headers("X-Share-Token") shareToken: string,
  ): Promise<{ downloadUrl: SharedMediaDownloadUrlResponse }> {
    if (!shareToken) {
      throw new UnauthorizedException("Missing X-Share-Token header");
    }

    const downloadUrl = await this.sharingService.getSharedMediaDownloadUrl(
      shareId,
      mediaId,
      shareToken,
      variant,
    );
    return { downloadUrl };
  }
}
