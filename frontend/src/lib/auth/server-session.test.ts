import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_AUTH_COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE;
const ORIGINAL_AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE;
const ORIGINAL_AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN;

describe("resolveAuthCookieOptions", () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    process.env.AUTH_COOKIE_SAME_SITE = ORIGINAL_AUTH_COOKIE_SAME_SITE;
    process.env.AUTH_COOKIE_SECURE = ORIGINAL_AUTH_COOKIE_SECURE;
    process.env.AUTH_COOKIE_DOMAIN = ORIGINAL_AUTH_COOKIE_DOMAIN;
    vi.resetModules();
  });

  it("defaults to lax non-secure cookies in development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_SAME_SITE;
    delete process.env.AUTH_COOKIE_SECURE;
    delete process.env.AUTH_COOKIE_DOMAIN;

    const { resolveAuthCookieOptions } = await import("./server-session");

    expect(resolveAuthCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      priority: "high",
    });
  });

  it("rejects insecure same-site none cookies", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_COOKIE_SAME_SITE = "none";
    process.env.AUTH_COOKIE_SECURE = "false";

    const { resolveAuthCookieOptions } = await import("./server-session");

    expect(() => resolveAuthCookieOptions()).toThrow(
      /AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true/i,
    );
  });

  it("rejects localhost cookie domains in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_SAME_SITE;
    delete process.env.AUTH_COOKIE_SECURE;
    process.env.AUTH_COOKIE_DOMAIN = "localhost";

    const { resolveAuthCookieOptions } = await import("./server-session");

    expect(() => resolveAuthCookieOptions()).toThrow(
      /AUTH_COOKIE_DOMAIN must not target localhost/i,
    );
  });
});