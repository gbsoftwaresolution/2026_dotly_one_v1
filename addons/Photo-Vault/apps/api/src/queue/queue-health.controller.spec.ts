import { QueueHealthController } from "./queue-health.controller";

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

describe("QueueHealthController", () => {
  it("returns ok=true when redis ping + queues succeed", async () => {
    const mockRedis: any = {
      client: { ping: jest.fn().mockResolvedValue("PONG") },
    };
    const mockPrisma: any = {
      workerHeartbeat: {
        findMany: jest.fn().mockResolvedValue([
          {
            kind: "bullmq",
            instanceId: "w-1",
            startedAt: new Date(Date.now() - 60_000),
            lastSeenAt: new Date(),
          },
        ]),
      },
    };
    const mockConfig: any = { workerHeartbeatStaleSeconds: 60 };
    const mockQueue: any = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
      getRepeatableJobs: jest
        .fn()
        .mockResolvedValue([{ name: "job-1", id: "job-1", every: 1000 }]),
    };

    const controller = new QueueHealthController(
      mockRedis,
      mockPrisma,
      mockConfig,
      makeMockLogger() as any,
      mockQueue,
      mockQueue,
      mockQueue,
    );

    const result = await controller.getHealth({ requestId: "req-1" } as any);

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("req-1");
    expect(result.redis.ok).toBe(true);
    expect(result.workers.ok).toBe(true);
    expect(result.workers.instances.length).toBe(1);
    expect(result.queues.exports.ok).toBe(true);
    expect(result.queues.purge.ok).toBe(true);
    expect(result.queues.thumbnails.ok).toBe(true);
  });

  it("returns ok=false when redis ping fails", async () => {
    const mockRedis: any = {
      client: { ping: jest.fn().mockRejectedValue(new Error("down")) },
    };
    const mockPrisma: any = {
      workerHeartbeat: {
        findMany: jest.fn().mockResolvedValue([
          {
            kind: "bullmq",
            instanceId: "w-1",
            startedAt: new Date(Date.now() - 60_000),
            lastSeenAt: new Date(),
          },
        ]),
      },
    };
    const mockConfig: any = { workerHeartbeatStaleSeconds: 60 };
    const mockQueue: any = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
    };

    const controller = new QueueHealthController(
      mockRedis,
      mockPrisma,
      mockConfig,
      makeMockLogger() as any,
      mockQueue,
      mockQueue,
      mockQueue,
    );

    const result = await controller.getHealth({ requestId: "req-2" } as any);

    expect(result.ok).toBe(false);
    expect(result.redis.ok).toBe(false);
    expect(result.redis.error).toBe("down");
  });

  it("returns ok=false when no worker heartbeats are present", async () => {
    const mockRedis: any = {
      client: { ping: jest.fn().mockResolvedValue("PONG") },
    };
    const mockPrisma: any = {
      workerHeartbeat: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const mockConfig: any = { workerHeartbeatStaleSeconds: 60 };
    const mockQueue: any = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
    };

    const controller = new QueueHealthController(
      mockRedis,
      mockPrisma,
      mockConfig,
      makeMockLogger() as any,
      mockQueue,
      mockQueue,
      mockQueue,
    );

    const result = await controller.getHealth({ requestId: "req-3" } as any);

    expect(result.redis.ok).toBe(true);
    expect(result.workers.ok).toBe(false);
    expect(result.ok).toBe(false);
  });
});
