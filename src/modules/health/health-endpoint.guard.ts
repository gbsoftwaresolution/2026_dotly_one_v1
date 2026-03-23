import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class HealthEndpointGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredToken = this.configService.get<string>(
      "app.healthEndpointToken",
      "",
    );

    if (configuredToken.trim().length === 0) {
      throw new UnauthorizedException(
        "Health endpoint token is not configured",
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const providedToken = this.extractToken(request.headers ?? {});

    if (
      providedToken === null ||
      !tokensMatch(configuredToken, providedToken)
    ) {
      throw new UnauthorizedException("Invalid health endpoint token");
    }

    return true;
  }

  private extractToken(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const authorization = this.getHeaderValue(headers.authorization);

    if (authorization) {
      const [scheme, token] = authorization.split(" ");

      if (scheme === "Bearer" && token) {
        return token;
      }
    }

    return this.getHeaderValue(headers["x-health-token"]);
  }

  private getHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return typeof value[0] === "string" ? value[0] : null;
    }

    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
