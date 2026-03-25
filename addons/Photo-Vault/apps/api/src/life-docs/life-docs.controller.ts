import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LifeDocsService } from "./life-docs.service";
import {
  CreateLifeDocDto,
  LifeDocsFamilyOverviewResponse,
  LifeDocsRenewalSummaryResponse,
  LifeDocsSearchResponse,
  LifeDocsTimelineResponse,
  LifeDocListResponse,
  LifeDocResponse,
  LifeDocVersionsResponse,
  ReplaceLifeDocDto,
  SetLifeDocRenewalStateDto,
  UpdateLifeDocMaskedPrivacyDto,
  UpdateLifeDocRemindersDto,
  UpdateLifeDocDto,
} from "@booster-vault/shared";

@Controller("life-docs")
@UseGuards(JwtAuthGuard)
export class LifeDocsController {
  constructor(private readonly lifeDocs: LifeDocsService) {}

  @Get("timeline")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async timeline(
    @Request() req: ExpressRequest,
    @Query("months") months?: string,
    @Query("ownerId") ownerId?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
  ): Promise<LifeDocsTimelineResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.getTimeline({
      userId,
      months: months ? Number(months) : 12,
      ownerId,
      category,
      status,
    });
  }

  @Get("search")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async search(
    @Request() req: ExpressRequest,
    @Query("q") q?: string,
    @Query("ownerId") ownerId?: string,
    @Query("category") category?: string,
  ): Promise<LifeDocsSearchResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.search({ userId, q: q ?? "", ownerId, category });
  }

  @Get("family/overview")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async familyOverview(
    @Request() req: ExpressRequest,
  ): Promise<LifeDocsFamilyOverviewResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.getFamilyOverview(userId);
  }

  @Get("renewal/summary")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async renewalSummary(
    @Request() req: ExpressRequest,
  ): Promise<LifeDocsRenewalSummaryResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.getRenewalSummary(userId);
  }

  @Post()
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: ExpressRequest,
    @Body() dto: CreateLifeDocDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.create(userId, dto);
  }

  @Get()
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async list(@Request() req: ExpressRequest): Promise<LifeDocListResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.list(userId);
  }

  @Get(":id")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async getById(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.getById(userId, id);
  }

  @Get(":id/versions")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async versions(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
  ): Promise<LifeDocVersionsResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.getVersions(userId, id);
  }

  @Post(":id/versions/restore/:versionId")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async restoreVersion(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.restoreVersion(userId, id, versionId);
  }

  @Post(":id/renewal/state")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async setRenewalState(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Body() dto: SetLifeDocRenewalStateDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.setRenewalState(userId, id, dto);
  }

  @Put(":id/reminders")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async updateReminders(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Body() dto: UpdateLifeDocRemindersDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.updateReminders(userId, id, dto);
  }

  @Post(":id/reminders/test")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async testReminders(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.testReminders(userId, id);
  }

  @Put(":id/privacy/masked")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async updateMaskedPrivacy(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Body() dto: UpdateLifeDocMaskedPrivacyDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.updateMaskedPrivacy(userId, id, dto);
  }

  @Put(":id")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async update(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Body() dto: UpdateLifeDocDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.update(userId, id, dto);
  }

  @Delete(":id")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async delete(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.delete(userId, id);
  }

  @Post(":id/archive")
  @Throttle({ default: {} })
  @HttpCode(HttpStatus.OK)
  async archive(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.archive(userId, id);
  }

  @Post(":id/replace")
  @Throttle({ upload: {} })
  @HttpCode(HttpStatus.CREATED)
  async replace(
    @Request() req: ExpressRequest,
    @Param("id") id: string,
    @Body() dto: ReplaceLifeDocDto,
  ): Promise<LifeDocResponse> {
    const userId = (req as any).user?.sub;
    return this.lifeDocs.replace(userId, id, dto);
  }
}
