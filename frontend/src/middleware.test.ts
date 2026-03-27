import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { getAppOldRedirectPath, middleware } from "./middleware";

describe("getAppOldRedirectPath", () => {
  it("maps the legacy root to the app home", () => {
    expect(getAppOldRedirectPath("/app-old")).toBe("/app");
  });

  it("maps nested legacy routes to the matching app path", () => {
    expect(getAppOldRedirectPath("/app-old/connections/connection-1")).toBe(
      "/app/connections/connection-1",
    );
  });

  it("ignores non-legacy paths", () => {
    expect(getAppOldRedirectPath("/app/settings")).toBeNull();
  });
});

describe("middleware", () => {
  it("redirects app-old requests to the app surface and preserves query params", () => {
    const request = new NextRequest(
      "https://dotly.one/app-old/conversations/conversation-1?persona=persona-1",
    );

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://dotly.one/app/conversations/conversation-1?persona=persona-1",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("permissions-policy")).toContain(
      "geolocation=()",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("applies the same security headers to pass-through responses", () => {
    const request = new NextRequest("https://dotly.one/app/settings");

    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});