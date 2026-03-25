import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "../config/config.service";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

@Injectable()
export class TurnstileService {
  constructor(private readonly config: ConfigService) {}

  async verifyToken(args: { token: string; ip?: string }): Promise<void> {
    const token = (args.token ?? "").trim();
    if (!token) {
      throw new ForbiddenException("CAPTCHA required");
    }

    const secretKey = this.config.turnstileSecretKey;
    if (!secretKey) {
      // Misconfiguration; do not treat as user fault.
      throw new ServiceUnavailableException("CAPTCHA unavailable");
    }

    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", token);

    // Optional: omit IP by default to avoid collecting/storing it.
    if (args.ip) {
      body.set("remoteip", args.ip);
    }

    let data: TurnstileVerifyResponse;
    try {
      const res = await fetch(this.config.turnstileVerifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) {
        throw new Error(`Turnstile verify HTTP ${res.status}`);
      }

      data = (await res.json()) as TurnstileVerifyResponse;
    } catch {
      throw new ServiceUnavailableException("CAPTCHA unavailable");
    }

    if (!data?.success) {
      throw new ForbiddenException("CAPTCHA failed");
    }
  }
}
