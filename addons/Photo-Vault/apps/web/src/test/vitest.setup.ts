import "reflect-metadata";
import { webcrypto } from "node:crypto";

// Ensure WebCrypto is available (jsdom doesn't provide SubtleCrypto).
const g = globalThis as any;
if (!g.crypto?.subtle) {
  g.crypto = webcrypto;
}

// Ensure atob/btoa exist for base64 helpers used by crypto code.
if (!g.atob) {
  g.atob = (base64: string) => Buffer.from(base64, "base64").toString("binary");
}

if (!g.btoa) {
  g.btoa = (binary: string) => Buffer.from(binary, "binary").toString("base64");
}
