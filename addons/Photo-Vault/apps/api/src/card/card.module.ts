import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TurnstileService } from "../abuse/turnstile.service";
import { CardService } from "./card.service";
import { CardPublicController } from "./card.public.controller";
import { CardOwnerController } from "./card.owner.controller";
import { CardVCardController } from "./card.vcard.controller";
import { CardResolveController } from "./card.resolve.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CardService, TurnstileService],
  controllers: [
    CardPublicController,
    CardOwnerController,
    CardVCardController,
    CardResolveController,
  ],
  exports: [CardService],
})
export class CardModule {}
