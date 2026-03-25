import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import * as argon2 from "argon2";
import * as bcrypt from "bcrypt";

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly algorithm: "argon2id" | "bcrypt";

  constructor(private readonly configService: ConfigService) {
    this.algorithm = this.configService.get(
      "PASSWORD_HASHING_ALGORITHM",
      "argon2id",
    ) as "argon2id" | "bcrypt";
    this.logger.log(`Password hashing algorithm: ${this.algorithm}`);
  }

  async hashPassword(password: string): Promise<string> {
    if (this.algorithm === "argon2id") {
      return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    } else {
      const saltRounds = 12;
      return bcrypt.hash(password, saltRounds);
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (hash.startsWith("$argon2id$")) {
      return argon2.verify(hash, password);
    } else if (
      hash.startsWith("$2b$") ||
      hash.startsWith("$2a$") ||
      hash.startsWith("$2y$")
    ) {
      return bcrypt.compare(password, hash);
    }
    // Fallback to try both
    try {
      return await argon2.verify(hash, password);
    } catch {
      return bcrypt.compare(password, hash);
    }
  }

  generateRandomToken(length: number = 32): string {
    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const randomValues = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for environments without crypto (should not happen in Node.js)
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * 256);
      }
    }
    let result = "";
    for (let i = 0; i < length; i++) {
      const v = randomValues[i] ?? 0;
      result += charset[v % charset.length] ?? "";
    }
    return result;
  }

  async generateHashForToken(token: string): Promise<string> {
    // Use SHA-256 for token hashing (stored in DB)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
