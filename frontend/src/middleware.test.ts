import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/middleware-session";

import { middleware } from "./middleware";

describe("middleware", () => {
  it("redirects unauthenticated requests to login", () => {
    const request = new NextRequest("http://localhost:3001/app-old/analytics");

    const response = middleware(request);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/login?next=%2Fapp-old%2Fanalytics",
    );
  });

  it("allows authenticated requests through", () => {
    const request = new NextRequest("http://localhost:3001/app-old/analytics");
    request.cookies.set(ACCESS_TOKEN_COOKIE, "token");

    const response = middleware(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("preserves the full path for nested protected routes", () => {
    const request = new NextRequest(
      "http://localhost:3001/app-old/contacts/relationship-1",
    );

    const response = middleware(request);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/login?next=%2Fapp-old%2Fcontacts%2Frelationship-1",
    );
  });
});
