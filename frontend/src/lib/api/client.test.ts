import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

describe("getApiBaseUrl", () => {
  afterEach(() => {
    setNodeEnv(ORIGINAL_NODE_ENV);
    process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_API_BASE_URL;
    vi.resetModules();
  });

  it("uses the local default in development when unset", async () => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_API_BASE_URL;

    const { getApiBaseUrl } = await import("./client");

    expect(getApiBaseUrl()).toBe("http://localhost:3000/v1");
  });

  it("rejects insecure production API origins", async () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3000/v1";

    const { getApiBaseUrl } = await import("./client");

    expect(() => getApiBaseUrl()).toThrow(
      /NEXT_PUBLIC_API_BASE_URL must use HTTPS|must not target localhost/i,
    );
  });
});