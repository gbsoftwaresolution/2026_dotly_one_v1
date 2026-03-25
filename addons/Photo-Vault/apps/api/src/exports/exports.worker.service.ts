import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ExportsService } from "./exports.service";

/**
 * Deprecated: legacy interval-based exports worker.
 *
 * Exports are processed via BullMQ in `ExportsProcessor` running in the worker
 * application context (`apps/api/src/worker-main.ts`). This service is kept as
 * a no-op for backwards compatibility with any out-of-tree imports.
 */
@Injectable()
export class ExportsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportsWorkerService.name);

  constructor(private readonly exportsService: ExportsService) {}

  onModuleInit() {
    this.logger.warn(
      "ExportsWorkerService is deprecated and disabled. Use BullMQ workers (pnpm worker) instead.",
    );
  }

  onModuleDestroy() {
    // no-op
  }

  /**
   * Manually trigger cleanup of expired exports
   */
  async triggerCleanup(): Promise<number> {
    return await this.exportsService.cleanupExpiredExports();
  }

  /**
   * Manually trigger watchdog cleanup of stuck exports
   */
  async triggerWatchdog(): Promise<number> {
    return await this.exportsService.cleanupStuckExports();
  }
}
