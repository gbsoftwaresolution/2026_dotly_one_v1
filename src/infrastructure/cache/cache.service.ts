import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CacheService {
  constructor(private readonly configService: ConfigService) {}

  getRedisUrl(): string {
    return this.configService.get<string>(
      "redis.url",
      "redis://localhost:6379",
    );
  }
}
