import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import type { JwtPayload } from "../../modules/auth/interfaces/jwt-payload.interface";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Authentication token is required");
    }

    try {
      const issuer = this.configService.get<string>(
        "jwt.issuer",
        "dotly-backend",
      );
      const audience = this.configService.get<string>(
        "jwt.audience",
        "dotly-clients",
      );
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        issuer,
        audience,
      });

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException("Invalid authentication token");
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Invalid authentication token");
    }
  }

  private extractToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return null;
    }

    return token;
  }
}
