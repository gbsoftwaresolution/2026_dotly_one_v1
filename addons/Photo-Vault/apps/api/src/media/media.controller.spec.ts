import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ConfigService } from "../config/config.service";

describe("MediaController", () => {
  let controller: MediaController;
  let mediaService: { listMedia: jest.Mock };

  beforeEach(async () => {
    mediaService = {
      listMedia: jest.fn(),
    };

    const prisma: Partial<Record<string, any>> = {};
    const config: Partial<Record<string, any>> = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        { provide: MediaService, useValue: mediaService },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MediaController>(MediaController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("forwards albumId to MediaService.listMedia", async () => {
    mediaService.listMedia.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    });

    const req: any = { user: { sub: "user-1" } };

    await controller.listMedia(
      req,
      "false",
      "25",
      undefined,
      undefined,
      undefined,
      "1f5c340e-9e76-4bdb-9d0e-0da2ea0f4a6d",
    );

    expect(mediaService.listMedia).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        albumId: "1f5c340e-9e76-4bdb-9d0e-0da2ea0f4a6d",
        includeTrashed: false,
        limit: 25,
      }),
    );
  });
});
