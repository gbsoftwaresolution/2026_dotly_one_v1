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
