import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    request.user =
      (await this.jwtAuthGuard.authenticateRequestIfPresent(request)) ??
      undefined;

    return true;
  }
}
