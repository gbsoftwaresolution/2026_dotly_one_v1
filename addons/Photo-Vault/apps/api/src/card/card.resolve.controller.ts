import { Controller, Get, Param } from "@nestjs/common";
import type { ResolveUsernameResponse } from "@booster-vault/shared";
import { CardService } from "./card.service";

@Controller("card")
export class CardResolveController {
  constructor(private readonly cardService: CardService) {}

  @Get("resolve-username/:username")
  async resolveUsername(
    @Param("username") username: string,
  ): Promise<ResolveUsernameResponse> {
    return this.cardService.resolveUsername({ username });
  }
}
