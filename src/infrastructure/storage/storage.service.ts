import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  getBucketName(): string {
    return this.configService.get<string>("storage.bucket", "");
  }
}
