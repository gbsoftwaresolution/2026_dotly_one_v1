import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

import { CacheService } from "../../infrastructure/cache/cache.service";

const SUPPORT_REQUEST_WINDOW_SECONDS = 60 * 15;
const SUPPORT_REQUEST_LIMIT_PER_IP = 5;
const SUPPORT_REQUEST_LIMIT_PER_EMAIL = 3;

@Injectable()
export class SupportRateLimitService {
  constructor(private readonly cacheService: CacheService) {}

  async consume(email: string, ipAddress?: string | null): Promise<void> {
    const keys = [
      `support:request:email:${email.trim().toLowerCase()}`,
      ...(ipAddress?.trim() ? [`support:request:ip:${ipAddress.trim()}`] : []),
    ];

    for (const key of keys) {
      const count = await this.cacheService.increment(
        key,
        SUPPORT_REQUEST_WINDOW_SECONDS,
      );

      if (count === null) {
        continue;
      }

      const limit = key.includes(":email:")
        ? SUPPORT_REQUEST_LIMIT_PER_EMAIL
        : SUPPORT_REQUEST_LIMIT_PER_IP;

      if (count > limit) {
        throw new HttpException(
          "Too many support requests right now. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }
}
