import { Injectable } from "@nestjs/common";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class QueueBackoffService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Run a startup task that depends on Redis, retrying forever with exponential backoff.
   *
   * Important: this never throws (so worker startup won't crash if Redis is down).
   */
  runWithBackoff(args: {
    label: string;
    fn: () => Promise<void>;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }): void {
    const initialDelayMs =
      typeof args.initialDelayMs === "number" &&
      Number.isFinite(args.initialDelayMs)
        ? args.initialDelayMs
        : 1_000;

    const maxDelayMs =
      typeof args.maxDelayMs === "number" && Number.isFinite(args.maxDelayMs)
        ? args.maxDelayMs
        : 60_000;

    void this.tryOnce({
      label: args.label,
      fn: args.fn,
      delayMs: initialDelayMs,
      maxDelayMs,
    });
  }

  private async tryOnce(args: {
    label: string;
    fn: () => Promise<void>;
    delayMs: number;
    maxDelayMs: number;
  }): Promise<void> {
    const log = this.logger.child({
      component: "queue-backoff",
      task: args.label,
    });

    try {
      await args.fn();
      log.log("Startup task completed");
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const nextDelayBase = Math.min(
        args.maxDelayMs,
        Math.max(250, args.delayMs),
      );
      // +-20% jitter
      const jitter = 0.8 + Math.random() * 0.4;
      const nextDelayMs = Math.round(nextDelayBase * jitter);

      log.warn(
        { err: message, retryInMs: nextDelayMs },
        "Startup task failed; will retry",
      );

      const timer = setTimeout(() => {
        void this.tryOnce({
          label: args.label,
          fn: args.fn,
          delayMs: Math.min(args.maxDelayMs, args.delayMs * 2),
          maxDelayMs: args.maxDelayMs,
        });
      }, nextDelayMs);

      timer.unref?.();
    }
  }
}
