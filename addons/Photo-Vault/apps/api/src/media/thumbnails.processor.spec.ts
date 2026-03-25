import type { Job } from "bullmq";
import { ThumbnailsProcessor } from "./thumbnails.processor";
import { THUMBNAILS_JOB_NAMES } from "./thumbnails.queue";

function makeMockLogger() {
  return {
    child: jest.fn().mockReturnThis(),
    setContext: jest.fn(),
    getContext: jest.fn().mockReturnValue({}),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };
}

describe("ThumbnailsProcessor", () => {
  it("scan job enqueues verify jobs for pending thumbnails", async () => {
    const mockPrisma: any = {
      media: {
        findMany: jest.fn().mockResolvedValue([
          { id: "m-1", userId: "u-1" },
          { id: "m-2", userId: "u-2" },
        ]),
      },
    };

    const mockStorage: any = { objectExists: jest.fn() };
    const mockConfig: any = { thumbnailVerifyScanBatchSize: 50 };
    const mockQueue: any = {
      enqueueVerify: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ThumbnailsProcessor(
      mockPrisma,
      mockStorage,
      mockConfig,
      mockQueue,
      makeMockLogger() as any,
    );

    const job = {
      id: "j-scan",
      name: THUMBNAILS_JOB_NAMES.scanPending,
      attemptsMade: 0,
      data: { ctx: { entityId: "thumbnails" }, payload: {} },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.media.findMany).toHaveBeenCalledTimes(1);
    expect(mockQueue.enqueueVerify).toHaveBeenCalledWith({
      mediaId: "m-1",
      userId: "u-1",
    });
    expect(mockQueue.enqueueVerify).toHaveBeenCalledWith({
      mediaId: "m-2",
      userId: "u-2",
    });
  });

  it("verify job sets thumbUploadedAt when object exists", async () => {
    const mockPrisma: any = {
      media: {
        findUnique: jest.fn().mockResolvedValue({
          id: "m-1",
          userId: "u-1",
          thumbObjectKey: "u/u-1/thumbs/m-1",
          thumbUploadedAt: null,
        }),
        update: jest.fn().mockResolvedValue({ id: "m-1" }),
      },
    };

    const mockStorage: any = {
      objectExists: jest.fn().mockResolvedValue(true),
    };
    const mockConfig: any = { thumbnailVerifyScanBatchSize: 50 };
    const mockQueue: any = { enqueueVerify: jest.fn() };

    const processor = new ThumbnailsProcessor(
      mockPrisma,
      mockStorage,
      mockConfig,
      mockQueue,
      makeMockLogger() as any,
    );

    const job = {
      id: "m-1",
      name: THUMBNAILS_JOB_NAMES.verify,
      attemptsMade: 0,
      data: {
        ctx: { entityId: "m-1", userId: "u-1" },
        payload: { mediaId: "m-1", userId: "u-1" },
      },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ok: true });
    expect(mockStorage.objectExists).toHaveBeenCalledWith("u/u-1/thumbs/m-1");
    expect(mockPrisma.media.update).toHaveBeenCalled();
  });
});
