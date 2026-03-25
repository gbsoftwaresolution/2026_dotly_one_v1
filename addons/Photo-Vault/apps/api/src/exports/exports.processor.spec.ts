import { ExportsProcessor } from "./exports.processor";
import { EXPORTS_JOB_NAMES } from "./exports.queue";
import type { Job } from "bullmq";

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

describe("ExportsProcessor", () => {
  it("processes exports:run by calling ExportsService.processExportJobQueued", async () => {
    const mockExportsService: any = {
      processExportJobQueued: jest.fn().mockResolvedValue(undefined),
      cleanupExpiredExports: jest.fn(),
      cleanupStuckExports: jest.fn(),
    };

    const logger = makeMockLogger();
    const processor = new ExportsProcessor(mockExportsService, logger as any);

    const job = {
      id: "job-1",
      name: EXPORTS_JOB_NAMES.run,
      attemptsMade: 0,
      data: {
        ctx: { requestId: "req-1", userId: "user-1", entityId: "exp-1" },
        payload: { exportId: "exp-1", userId: "user-1" },
      },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ok: true });
    expect(mockExportsService.processExportJobQueued).toHaveBeenCalledWith({
      exportId: "exp-1",
      userId: "user-1",
      requestId: "req-1",
      attempt: 1,
    });
  });

  it("processes exports:cleanup-expired by calling ExportsService.cleanupExpiredExports", async () => {
    const mockExportsService: any = {
      processExportJobQueued: jest.fn(),
      cleanupExpiredExports: jest.fn().mockResolvedValue(3),
      cleanupStuckExports: jest.fn(),
    };

    const logger = makeMockLogger();
    const processor = new ExportsProcessor(mockExportsService, logger as any);

    const job = {
      id: "job-2",
      name: EXPORTS_JOB_NAMES.cleanupExpired,
      attemptsMade: 1,
      data: { ctx: { entityId: "exports" }, payload: {} },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ cleaned: 3 });
    expect(mockExportsService.cleanupExpiredExports).toHaveBeenCalledTimes(1);
  });

  it("processes exports:watchdog-stuck by calling ExportsService.cleanupStuckExports", async () => {
    const mockExportsService: any = {
      processExportJobQueued: jest.fn(),
      cleanupExpiredExports: jest.fn(),
      cleanupStuckExports: jest.fn().mockResolvedValue(2),
    };

    const logger = makeMockLogger();
    const processor = new ExportsProcessor(mockExportsService, logger as any);

    const job = {
      id: "job-4",
      name: EXPORTS_JOB_NAMES.watchdogStuck,
      attemptsMade: 0,
      data: { ctx: { entityId: "exports" }, payload: {} },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ cleaned: 2 });
    expect(mockExportsService.cleanupStuckExports).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown job name", async () => {
    const mockExportsService: any = {
      processExportJobQueued: jest.fn(),
      cleanupExpiredExports: jest.fn(),
      cleanupStuckExports: jest.fn(),
    };

    const logger = makeMockLogger();
    const processor = new ExportsProcessor(mockExportsService, logger as any);

    const job = {
      id: "job-3",
      name: "exports:unknown",
      attemptsMade: 0,
      data: { ctx: { entityId: "exports" }, payload: {} },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual({ ignored: true });
    expect(mockExportsService.processExportJobQueued).not.toHaveBeenCalled();
  });
});
