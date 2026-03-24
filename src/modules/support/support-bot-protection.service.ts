import { Injectable } from "@nestjs/common";

const MIN_SUBMISSION_AGE_MS = 1_500;
const MAX_SUBMISSION_AGE_MS = 1000 * 60 * 60 * 24;

@Injectable()
export class SupportBotProtectionService {
  async verify(token?: string | null): Promise<boolean> {
    const normalized = token?.trim() ?? "";

    if (!normalized) {
      return false;
    }

    const startedAt = Number(normalized);

    if (!Number.isFinite(startedAt)) {
      return false;
    }

    const ageMs = Date.now() - startedAt;

    return ageMs >= MIN_SUBMISSION_AGE_MS && ageMs <= MAX_SUBMISSION_AGE_MS;
  }
}
