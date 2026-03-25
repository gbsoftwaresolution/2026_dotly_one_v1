import {
  Controller,
  Get,
  Post,
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
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { ExportsService } from "./exports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import {
  CreateExportDto,
  ExportResponse,
  PaginatedExportsResponse,
  ExportDownloadUrlResponse,
} from "@booster-vault/shared";

@Controller("exports")
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  /**
   * List user's export jobs
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listExports(
    @Request() req: ExpressRequest,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<{ exports: PaginatedExportsResponse }> {
    const userId = (req as any).user?.sub;
    const exports = await this.exportsService.listExports(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
    return { exports };
  }

  /**
   * Create a new export job
   */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async createExport(
    @Request() req: ExpressRequest,
    @Body() createExportDto: CreateExportDto,
  ): Promise<{ export: ExportResponse }> {
    const userId = (req as any).user?.sub;
    const requestId = (req as any).requestId as string | undefined;
    const exportJob = await this.exportsService.createExport(
      userId,
      createExportDto,
      requestId,
    );
    return { export: exportJob };
  }

  /**
   * Get a single export job
   */
  @Get(":exportId")
  @HttpCode(HttpStatus.OK)
  async getExport(
    @Request() req: ExpressRequest,
    @Param("exportId", ParseUUIDPipe) exportId: string,
  ): Promise<{ export: ExportResponse }> {
    const userId = (req as any).user?.sub;
    const exportJob = await this.exportsService.getExport(userId, exportId);
    return { export: exportJob };
  }

  /**
   * Generate a signed download URL for a READY export
   */
  @Post(":exportId/download-url")
  @HttpCode(HttpStatus.OK)
  async createDownloadUrl(
    @Request() req: ExpressRequest,
    @Param("exportId", ParseUUIDPipe) exportId: string,
  ): Promise<{ downloadUrl: ExportDownloadUrlResponse }> {
    const userId = (req as any).user?.sub;
    const downloadUrl = await this.exportsService.createDownloadUrl(
      userId,
      exportId,
    );
    return { downloadUrl };
  }

  /**
   * Delete (or cancel) an export job.
   * If a worker is currently processing, it will safely no-op once the record is gone.
   */
  @Delete(":exportId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExport(
    @Request() req: ExpressRequest,
    @Param("exportId", ParseUUIDPipe) exportId: string,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.exportsService.deleteExport(userId, exportId);
  }
}
