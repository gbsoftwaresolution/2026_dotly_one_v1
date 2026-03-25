import type { Job } from "bullmq";

export class JobTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly label: string;

  constructor(args: { label: string; timeoutMs: number }) {
    super(`Job timed out after ${args.timeoutMs}ms: ${args.label}`);
    this.name = "JobTimeoutError";
    this.timeoutMs = args.timeoutMs;
    this.label = args.label;
  }
}

export async function withTimeout<T>(args: {
  label: string;
  timeoutMs: number;
  promise: Promise<T>;
}): Promise<T> {
  const timeoutMs = args.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return args.promise;
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new JobTimeoutError({ label: args.label, timeoutMs }));
    }, timeoutMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([args.promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function jobDurationMs(job: Job | null | undefined): number | undefined {
  const processedOn = job?.processedOn ?? undefined;
  const finishedOn = job?.finishedOn ?? undefined;
  if (!processedOn || !finishedOn) return undefined;
  const duration = finishedOn - processedOn;
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

export function safeJobAttempt(
  job: Job | null | undefined,
): number | undefined {
  if (!job) return undefined;
  // bullmq attemptsMade is 0-based completed attempts.
  const attempt = (job.attemptsMade ?? 0) + 1;
  return Number.isFinite(attempt) && attempt > 0 ? attempt : undefined;
}
