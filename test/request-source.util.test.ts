import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  getClientIpAddress,
  getForwardedProtocol,
  getHeaderValue,
} from "../src/common/utils/request-source.util";

describe("request source utils", () => {
  it("prefers trusted request properties over raw forwarded headers", () => {
    const request = {
      ip: "203.0.113.10",
      protocol: "https",
      secure: true,
      headers: {
        "x-forwarded-for": "198.51.100.9",
        "x-forwarded-proto": "http",
      },
      socket: { remoteAddress: "10.0.0.10" },
    };

    assert.equal(getClientIpAddress(request), "203.0.113.10");
    assert.equal(getForwardedProtocol(request), "https");
  });

  it("falls back to socket details when proxy trust is disabled", () => {
    const request = {
      headers: {
        "x-forwarded-for": "198.51.100.9",
        "x-forwarded-proto": "https",
      },
      socket: { remoteAddress: "10.0.0.10" },
      secure: false,
    };

    assert.equal(getClientIpAddress(request), "10.0.0.10");
    assert.equal(getForwardedProtocol(request), null);
  });

  it("normalizes header reads", () => {
    assert.equal(
      getHeaderValue(
        { headers: { "x-request-id": [" req-123 "] } },
        "x-request-id",
      ),
      "req-123",
    );
    assert.equal(getHeaderValue({ headers: {} }, "x-request-id"), null);
  });
});
