import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";

export type HeirAuthContext = {
  recipientId: string;
  ownerId: string;
};

type HeirJwtPayload = {
  sub?: string;
  recipientId?: string;
  ownerId?: string;
  typ?: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class HeirAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("No token provided");
    }

    let payload: HeirJwtPayload;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.heirJwtSecret,
      });
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    const recipientId =
      typeof payload?.recipientId === "string"
        ? payload.recipientId
        : undefined;
    const ownerId =
      typeof payload?.ownerId === "string" ? payload.ownerId : undefined;

    if (!recipientId || !ownerId) {
      throw new UnauthorizedException("Invalid token");
    }

    // Subject must be the continuity recipient (not a User session).
    if (payload.sub !== recipientId) {
      throw new UnauthorizedException("Invalid token");
    }

    if (payload.typ !== "heir") {
      throw new UnauthorizedException("Invalid token");
    }

    const recipient = await this.prisma.continuityRecipient.findUnique({
      where: { id: recipientId },
      select: { id: true, ownerId: true },
    });

    if (!recipient || recipient.ownerId !== ownerId) {
      throw new UnauthorizedException("Invalid token");
    }

    (request as unknown as { heir: HeirAuthContext }).heir = {
      recipientId,
      ownerId,
    };
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
