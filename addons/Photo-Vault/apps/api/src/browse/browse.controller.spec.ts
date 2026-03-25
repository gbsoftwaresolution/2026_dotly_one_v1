import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { BrowseController } from "./browse.controller";
import { TimelineService } from "./timeline.service";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

describe("BrowseController", () => {
  let controller: BrowseController;

  const mockTimelineService = {
    getTimeline: jest.fn(),
  };

  const mockSearchService = {
    search: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrowseController],
      providers: [
        { provide: TimelineService, useValue: mockTimelineService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BrowseController>(BrowseController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getTimeline", () => {
    it("should call timelineService.getTimeline with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const mockResponse = {
        items: [],
        pagination: { limit: 50, nextCursor: undefined },
      };
      mockTimelineService.getTimeline.mockResolvedValue(mockResponse);

      const result = await controller.getTimeline(
        req as any,
        undefined, // year
        undefined, // albumId
        "50", // limit
        undefined, // cursor
      );

      expect(mockTimelineService.getTimeline).toHaveBeenCalledWith("user-123", {
        year: undefined,
        albumId: undefined,
        limit: 50,
        cursor: undefined,
      });
      expect(result).toEqual({ timeline: mockResponse });
    });

    it("should validate limit bounds", async () => {
      const req = { user: { sub: "user-123" } };

      // Test limit too high
      await expect(
        controller.getTimeline(
          req as any,
          undefined,
          undefined,
          "300",
          undefined,
        ),
      ).rejects.toThrow("limit cannot exceed 200");

      // Test invalid limit
      await expect(
        controller.getTimeline(
          req as any,
          undefined,
          undefined,
          "invalid",
          undefined,
        ),
      ).rejects.toThrow("limit must be a positive integer");

      // Test negative limit
      await expect(
        controller.getTimeline(
          req as any,
          undefined,
          undefined,
          "-1",
          undefined,
        ),
      ).rejects.toThrow("limit must be a positive integer");
    });

    it("should pass year and albumId correctly", async () => {
      const req = { user: { sub: "user-123" } };
      const mockResponse = {
        items: [],
        pagination: { limit: 30, nextCursor: undefined },
      };
      mockTimelineService.getTimeline.mockResolvedValue(mockResponse);

      const albumId = "550e8400-e29b-41d4-a716-446655440000";

      const result = await controller.getTimeline(
        req as any,
        "2024", // year
        albumId, // albumId
        "30", // limit
        "cursor-xyz", // cursor
      );

      expect(mockTimelineService.getTimeline).toHaveBeenCalledWith("user-123", {
        year: 2024,
        albumId,
        limit: 30,
        cursor: "cursor-xyz",
      });
      expect(result).toEqual({ timeline: mockResponse });
    });
  });

  describe("search", () => {
    it("should call searchService.search with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const mockResponse = {
        items: [],
        pagination: { limit: 50, nextCursor: undefined },
      };
      mockSearchService.search.mockResolvedValue(mockResponse);

      const result = await controller.search(
        req as any,
        "beach sunset", // q
        undefined, // from
        undefined, // to
        undefined, // albumId
        "50", // limit
        undefined, // cursor
      );

      expect(mockSearchService.search).toHaveBeenCalledWith("user-123", {
        q: "beach sunset",
        from: undefined,
        to: undefined,
        albumId: undefined,
        limit: 50,
        cursor: undefined,
      });
      expect(result).toEqual({ search: mockResponse });
    });

    it("should validate required query parameter", async () => {
      const req = { user: { sub: "user-123" } };

      // Test empty query
      await expect(
        controller.search(
          req as any,
          "",
          undefined,
          undefined,
          undefined,
          "50",
          undefined,
        ),
      ).rejects.toThrow(
        "q (query) is required and must be at least 1 character",
      );

      // Test whitespace-only query
      await expect(
        controller.search(
          req as any,
          "   ",
          undefined,
          undefined,
          undefined,
          "50",
          undefined,
        ),
      ).rejects.toThrow(
        "q (query) is required and must be at least 1 character",
      );
    });

    it("should validate limit bounds", async () => {
      const req = { user: { sub: "user-123" } };

      // Test limit too high
      await expect(
        controller.search(
          req as any,
          "test",
          undefined,
          undefined,
          undefined,
          "300",
          undefined,
        ),
      ).rejects.toThrow("limit cannot exceed 200");

      // Test invalid limit
      await expect(
        controller.search(
          req as any,
          "test",
          undefined,
          undefined,
          undefined,
          "invalid",
          undefined,
        ),
      ).rejects.toThrow("limit must be a positive integer");
    });

    it("should validate date parameters", async () => {
      const req = { user: { sub: "user-123" } };

      // Test invalid from date
      await expect(
        controller.search(
          req as any,
          "test",
          "invalid-date",
          undefined,
          undefined,
          "50",
          undefined,
        ),
      ).rejects.toThrow("from must be a valid ISO date string");

      // Test invalid to date
      await expect(
        controller.search(
          req as any,
          "test",
          undefined,
          "invalid-date",
          undefined,
          "50",
          undefined,
        ),
      ).rejects.toThrow("to must be a valid ISO date string");

      // Test valid dates
      const mockResponse = {
        items: [],
        pagination: { limit: 50, nextCursor: undefined },
      };
      mockSearchService.search.mockResolvedValue(mockResponse);

      const albumId = "550e8400-e29b-41d4-a716-446655440000";

      const result = await controller.search(
        req as any,
        "test",
        "2024-01-01T00:00:00.000Z",
        "2024-12-31T23:59:59.999Z",
        albumId,
        "50",
        "cursor-xyz",
      );

      expect(mockSearchService.search).toHaveBeenCalledWith("user-123", {
        q: "test",
        from: new Date("2024-01-01T00:00:00.000Z"),
        to: new Date("2024-12-31T23:59:59.999Z"),
        albumId,
        limit: 50,
        cursor: "cursor-xyz",
      });
      expect(result).toEqual({ search: mockResponse });
    });
  });
});
