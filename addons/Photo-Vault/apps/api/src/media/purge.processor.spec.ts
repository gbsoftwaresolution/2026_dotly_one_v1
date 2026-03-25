import type { Job } from "bullmq";
import { PurgeProcessor } from "./purge.processor";
import { PURGE_JOB_NAMES } from "./purge.queue";

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

describe("PurgeProcessor", () => {
  it("scan job enqueues media purge jobs for due trashed media", async () => {
    const mockPrisma: any = {
      media: {
        findMany: jest.fn().mockResolvedValue([
          { id: "m-1", userId: "u-1" },
          { id: "m-2", userId: "u-1" },
        ]),
      },
    };

    const mockStorage: any = { deleteObject: jest.fn() };
    const mockQueue: any = {
      enqueueMediaPurge: jest.fn().mockResolvedValue(undefined),
    };
    const mockConfig: any = { purgeScanBatchSize: 100 };

    const processor = new PurgeProcessor(
      mockPrisma,
      mockStorage,
      mockQueue,
      mockConfig,
      makeMockLogger() as any,
    );

    const job = {
      id: "j-scan",
      name: PURGE_JOB_NAMES.scanDue,
      attemptsMade: 0,
      data: { ctx: { entityId: "purge" }, payload: {} },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.media.findMany).toHaveBeenCalledTimes(1);
    expect(mockQueue.enqueueMediaPurge).toHaveBeenCalledWith({
      mediaId: "m-1",
      userId: "u-1",
    });
    expect(mockQueue.enqueueMediaPurge).toHaveBeenCalledWith({
      mediaId: "m-2",
      userId: "u-1",
    });
  });

  it("media purge deletes ciphertext objects + DB row (happy path)", async () => {
    const tx = {
      album: { updateMany: jest.fn().mockResolvedValue(undefined) },
      media: { delete: jest.fn().mockResolvedValue(undefined) },
      userUsage: { update: jest.fn().mockResolvedValue(undefined) },
      auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    };

    const mockPrisma: any = {
      media: {
        findUnique: jest.fn().mockResolvedValue({
          id: "m-1",
          userId: "u-1",
          type: "PHOTO",
          isTrashed: true,
          purgeAfter: new Date(Date.now() - 60_000),
          objectKey: "u/u-1/media/m-1",
          thumbObjectKey: "u/u-1/thumbs/m-1",
        }),
      },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };

    const mockStorage: any = {
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const mockQueue: any = { enqueueMediaPurge: jest.fn() };
    const mockConfig: any = { purgeScanBatchSize: 100 };

    const processor = new PurgeProcessor(
      mockPrisma,
      mockStorage,
      mockQueue,
      mockConfig,
      makeMockLogger() as any,
    );

    const job = {
      id: "m-1",
      name: PURGE_JOB_NAMES.media,
      attemptsMade: 0,
      data: {
        ctx: { entityId: "m-1", userId: "u-1" },
        payload: { mediaId: "m-1", userId: "u-1" },
      },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ok: true });
    expect(mockStorage.deleteObject).toHaveBeenCalledWith("u/u-1/media/m-1");
    expect(mockStorage.deleteObject).toHaveBeenCalledWith("u/u-1/thumbs/m-1");
    expect(tx.album.updateMany).toHaveBeenCalled();
    expect(tx.media.delete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    expect(tx.userUsage.update).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
});
