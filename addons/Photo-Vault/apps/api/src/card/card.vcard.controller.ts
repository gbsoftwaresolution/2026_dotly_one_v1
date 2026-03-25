import {
  Controller,
  Get,
  Headers,
  Query,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { CardService } from "./card.service";

@Controller("card")
export class CardVCardController {
  constructor(private readonly cardService: CardService) {}

  @Get("vcard")
  @Throttle({ "card-token-public": {} })
  async vcard(
    @Headers("x-card-token") rawToken: string | undefined,
    @Query("publicId") publicId: string,
    @Query("modeSlug") modeSlug: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, vcf } = await this.cardService.generateVCard({
      rawToken: rawToken ?? "",
      publicId,
      modeSlug,
    });

    const safeName = String(filename || "contact.vcf")
      .replace(/\s+/g, " ")
      .replace(/[\\/\0<>:\"|?*]+/g, "-")
      .replace(/[\r\n]/g, " ")
      .trim()
      .slice(0, 180);

    const disposition = `attachment; filename="${safeName.replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;

    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", disposition);

    res.status(HttpStatus.OK).send(vcf);
  }
}
