import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  type SessionValidationResult,
  DeviceSessionService,
} from "../../modules/auth/device-session.service";
import { AUTH_ERROR_MESSAGES } from "../../modules/auth/auth-error-policy";
import type { JwtPayload } from "../../modules/auth/interfaces/jwt-payload.interface";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly deviceSessionService: DeviceSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    let authenticatedUser: AuthenticatedUser | null;

    try {
      authenticatedUser = await this.authenticateRequest(request);
    } catch {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.invalidAuthenticationToken,
      );
    }

    if (!authenticatedUser) {
      throw new UnauthorizedException("Authentication token is required");
    }

    request.user = authenticatedUser;
    return true;
  }

  async authenticateRequestIfPresent(request: {
    headers: { authorization?: string };
    user?: AuthenticatedUser;
  }): Promise<AuthenticatedUser | null> {
    try {
      return await this.authenticateRequest(request);
    } catch {
      return null;
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

  private async authenticateRequest(request: {
    headers: { authorization?: string };
    user?: AuthenticatedUser;
  }): Promise<AuthenticatedUser | null> {
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      return null;
    }

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

    if (!payload.sub || !payload.email || !payload.sessionId) {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.invalidAuthenticationToken,
      );
    }

    const session: SessionValidationResult =
      await this.deviceSessionService.validateSession(
        payload.sub,
        payload.sessionId,
      );

    if (session.status !== "active") {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.invalidAuthenticationToken,
      );
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        AUTH_ERROR_MESSAGES.invalidAuthenticationToken,
      );
    }

    return {
      id: payload.sub,
      email: payload.email,
      isVerified: user.isVerified,
      sessionId: payload.sessionId,
    };
  }
}
