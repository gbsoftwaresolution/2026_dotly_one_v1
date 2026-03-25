import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type CardContactRevealResponse,
  CreateCardContactRequestDto,
  type CreateCardContactRequestResponse,
  type GetPublicCardModeResponse,
} from "@booster-vault/shared";
import { ConfigService } from "../config/config.service";
import { TurnstileService } from "../abuse/turnstile.service";
import { CardService } from "./card.service";

@Controller("card/public")
export class CardPublicController {
  constructor(
    private readonly cardService: CardService,
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Get(":publicId/modes/:modeSlug")
  @Throttle({ "card-public": {} })
  async getMode(
    @Param("publicId") publicId: string,
    @Param("modeSlug") modeSlug: string,
  ): Promise<GetPublicCardModeResponse> {
    return this.cardService.getPublicModeView({ publicId, modeSlug });
  }

  @Post(":publicId/modes/:modeSlug/contact-requests")
  @Throttle({ "card-contact-public": {} })
  @HttpCode(HttpStatus.CREATED)
  async createContactRequest(
    @Param("publicId") publicId: string,
    @Param("modeSlug") modeSlug: string,
    @Body() dto: CreateCardContactRequestDto,
  ): Promise<{ request: CreateCardContactRequestResponse }> {
    if (this.config.turnstileEnabled) {
      const token = (dto as any)?.captchaToken;
      if (!token) {
        throw new ForbiddenException("CAPTCHA required");
      }

      // Intentionally omit IP by default to avoid collecting PII.
      await this.turnstile.verifyToken({ token });
    }

    const request = await this.cardService.createContactRequest({
      publicId,
      modeSlug,
      dto,
    });

    return { request };
  }

  @Get(":publicId/modes/:modeSlug/contact")
  @Throttle({ "card-token-public": {} })
  async revealContact(
    @Headers("x-card-token") rawToken: string | undefined,
    @Param("publicId") publicId: string,
    @Param("modeSlug") modeSlug: string,
  ): Promise<{ contact: CardContactRevealResponse }> {
    const contact = await this.cardService.revealContact({
      rawToken: rawToken ?? "",
      publicId,
      modeSlug,
    });

    return { contact };
  }
}
