import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { SessionsService } from "../sessions.service";
import { LoggerService } from "../../logger/logger.service";

@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly loggerService: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("No token provided");
    }

    try {
      const payload = this.jwtService.verify(token);
      // Attach user to request object
      request["user"] = payload;

      // Update session's last seen timestamp if sessionId is present
      if (payload.sessionId) {
        await this.updateSessionLastSeen(payload.sessionId);
      }

      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  /**
   * Update session's lastSeenAt timestamp
   * Note: We don't have userId here, but we can update by sessionId directly
   * This is safe because sessionId is unique and from a valid JWT
   */
  private async updateSessionLastSeen(sessionId: string): Promise<void> {
    const logger = this.loggerService.child({ context: JwtAuthGuard.name });
    try {
      // Use the sessions service method we just added
      await this.sessionsService.updateSessionLastSeen(sessionId);
    } catch (error) {
      // Don't fail authentication if lastSeenAt update fails
      logger.warn({
        msg: "Failed to update session lastSeenAt",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
