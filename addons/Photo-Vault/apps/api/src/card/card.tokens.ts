import { randomBytes } from "crypto";
import { hashCardToken } from "./card.util";

export function makeCardGrantToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashCardToken(rawToken);
  return { rawToken, tokenHash };
}
