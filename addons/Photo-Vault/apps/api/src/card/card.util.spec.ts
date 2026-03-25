import { hashCardToken, isGrantActive, makeCardPublicId } from "./card.util";

describe("card.util", () => {
  describe("makeCardPublicId", () => {
    it("returns a URL-safe token with at least 128 bits entropy", () => {
      const publicId = makeCardPublicId();

      expect(typeof publicId).toBe("string");
      expect(publicId.length).toBeGreaterThanOrEqual(22);

      // base64url charset: A-Z a-z 0-9 _ -
      expect(publicId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(publicId).not.toContain("+");
      expect(publicId).not.toContain("/");
      expect(publicId).not.toContain("=");
    });

    it("throws if requested entropy is below 128 bits", () => {
      expect(() => makeCardPublicId(15)).toThrow();
    });
  });

  describe("hashCardToken", () => {
    it("is deterministic and returns sha256 hex", () => {
      const h1 = hashCardToken("raw-token");
      const h2 = hashCardToken("raw-token");
      const h3 = hashCardToken("raw-token-2");

      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("isGrantActive", () => {
    it("returns true when not revoked and not expired", () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      expect(
        isGrantActive({ expiresAt: new Date("2026-01-01T00:00:01.000Z"), revokedAt: null }, now),
      ).toBe(true);
    });

    it("returns false when expired", () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      expect(
        isGrantActive({ expiresAt: new Date("2025-12-31T23:59:59.000Z"), revokedAt: null }, now),
      ).toBe(false);
    });

    it("returns false when revoked", () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      expect(
        isGrantActive({ expiresAt: new Date("2027-01-01T00:00:00.000Z"), revokedAt: new Date(now) }, now),
      ).toBe(false);
    });
  });
});
