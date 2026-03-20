import { Injectable } from "@nestjs/common";

@Injectable()
export class MailService {
  isConfigured(): boolean {
    return false;
  }
}
