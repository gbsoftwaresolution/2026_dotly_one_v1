import { Controller } from "@nestjs/common";

import { ContactMemoryService } from "./contact-memory.service";

@Controller("contact-memory")
export class ContactMemoryController {
  constructor(private readonly contactMemoryService: ContactMemoryService) {}
}
