import { Controller } from "@nestjs/common";

import { ContactRequestsService } from "./contact-requests.service";

@Controller("contact-requests")
export class ContactRequestsController {
  constructor(
    private readonly contactRequestsService: ContactRequestsService,
  ) {}
}
