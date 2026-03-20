import { Controller } from "@nestjs/common";

import { TrustAbuseService } from "./trust-abuse.service";

@Controller("trust-abuse")
export class TrustAbuseController {
  constructor(private readonly trustAbuseService: TrustAbuseService) {}
}
