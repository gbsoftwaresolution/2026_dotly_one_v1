import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const REQUESTS_PER_HOUR_LIMIT = 20;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

@Injectable()
export class RequestRateLimitService {
  private readonly attemptsByUser = new Map<string, number[]>();

  consume(userId: string, now = Date.now()): void {
    const attempts = this.pruneExpiredAttempts(
      this.attemptsByUser.get(userId) ?? [],
      now,
    );

    if (attempts.length >= REQUESTS_PER_HOUR_LIMIT) {
      this.attemptsByUser.set(userId, attempts);
      throw new HttpException(
        "Requests are temporarily limited",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempts.push(now);
    this.attemptsByUser.set(userId, attempts);
  }

  private pruneExpiredAttempts(attempts: number[], now: number): number[] {
    return attempts.filter((timestamp) => now - timestamp < ONE_HOUR_IN_MS);
  }
}
