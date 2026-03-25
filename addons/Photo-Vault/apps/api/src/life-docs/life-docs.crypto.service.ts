import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { ConfigService } from "../config/config.service";

type SealedJson = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string; // base64
  ct: string; // base64
  tag: string; // base64
};

@Injectable()
export class LifeDocsCryptoService {
  private readonly sealingKey: Buffer;
  private readonly hmacKey: Buffer;

  constructor(private readonly config: ConfigService) {
    this.sealingKey = Buffer.from(this.config.lifeDocsSealingKeyBase64, "base64");
    this.hmacKey = Buffer.from(this.config.lifeDocsAccessHmacKeyBase64, "base64");

    if (this.sealingKey.byteLength !== 32) {
      throw new Error("LIFE_DOCS_SEALING_KEY_BASE64 must decode to 32 bytes");
    }
    if (this.hmacKey.byteLength < 16) {
      throw new Error("LIFE_DOCS_ACCESS_HMAC_KEY_BASE64 too short");
    }
  }

  sealJson<T extends Record<string, any>>(value: T): SealedJson {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.sealingKey, iv);

    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      v: 1,
      alg: "aes-256-gcm",
      iv: iv.toString("base64"),
      ct: ciphertext.toString("base64"),
      tag: tag.toString("base64"),
    };
  }

  openJson<T>(sealed: any): T {
    const parsed = sealed as Partial<SealedJson>;
    if (parsed?.v !== 1 || parsed?.alg !== "aes-256-gcm") {
      throw new Error("Invalid sealed payload header");
    }

    const iv = Buffer.from(parsed.iv ?? "", "base64");
    const ct = Buffer.from(parsed.ct ?? "", "base64");
    const tag = Buffer.from(parsed.tag ?? "", "base64");

    if (iv.byteLength !== 12) throw new Error("Invalid iv");
    if (tag.byteLength !== 16) throw new Error("Invalid tag");

    const decipher = createDecipheriv("aes-256-gcm", this.sealingKey, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  }

  hmacUserId(userId: string): string {
    return createHmac("sha256", this.hmacKey).update(userId, "utf8").digest("base64");
  }
}

export type { SealedJson };
