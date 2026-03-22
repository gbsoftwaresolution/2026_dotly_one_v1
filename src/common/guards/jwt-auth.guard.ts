import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  DeviceSessionService,
  type SessionValidationResult,
} from "../../modules/auth/device-session.service";
import { AUTH_ERROR_MESSAGES } from "../../modules/auth/auth-error-policy";
import type { JwtPayload } from "../../modules/auth/interfaces/jwt-payload.interface";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

const noopPrismaService = {
  user: {
    findUnique: async () => ({
      id: "",
      email: "",
      isVerified: false,
    }),
  },
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly prismaService?: PrismaService,
    @Optional()
    private readonly deviceSessionService?: DeviceSessionService,
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

      if (!payload.sessionId) {
        throw new UnauthorizedException(AUTH_ERROR_MESSAGES.invalidAuthenticationToken);
      }

      const session: SessionValidationResult = this.deviceSessionService
        ? await this.deviceSessionService.validateSession(
            payload.sub,
            payload.sessionId,
          )
        : await this.validateSessionFallback(payload.sub, payload.sessionId);

      if (session.status !== "active") {
        throw new UnauthorizedException(AUTH_ERROR_MESSAGES.invalidAuthenticationToken);
      }

      const user = await (
        this.prismaService ?? (noopPrismaService as unknown as PrismaService)
      ).user.findUnique({
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
        throw new UnauthorizedException("Invalid authentication token");
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        isVerified: user.isVerified,
        sessionId: payload.sessionId,
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

  private async validateSessionFallback(
    userId: string,
    sessionId: string,
  ): Promise<SessionValidationResult> {
    const session = await (this.prismaService as any)?.authSession?.findFirst?.({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return {
        status: "missing",
      };
    }

    if (session.revokedAt) {
      return {
        status: "revoked",
        session: {
          id: session.id,
          revokedAt: session.revokedAt,
        },
      };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return {
        status: "expired",
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
      };
    }

    return {
      status: "active",
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }
}
