import { describe, expect, it } from "vitest";

import {
  createFrontendContentSecurityPolicy,
  getFrontendSecurityHeaders,
} from "./headers";

describe("frontend security headers", () => {
  it("builds a production CSP without development-only allowances", () => {
    const policy = createFrontendContentSecurityPolicy({
      nodeEnv: "production",
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain(" ws:");
  });

  it("keeps development websocket support while preserving the baseline policy", () => {
    const policy = createFrontendContentSecurityPolicy({
      nodeEnv: "development",
    });

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("connect-src 'self' https: http: ws: wss:");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("emits HSTS only for production builds", () => {
    const developmentHeaders = getFrontendSecurityHeaders({
      nodeEnv: "development",
    });
    const productionHeaders = getFrontendSecurityHeaders({
      nodeEnv: "production",
    });

    expect(
      developmentHeaders.find((header) => header.key === "Strict-Transport-Security"),
    ).toBeUndefined();
    expect(
      productionHeaders.find((header) => header.key === "Strict-Transport-Security")
        ?.value,
    ).toBe("max-age=31536000; includeSubDomains");
  });
});