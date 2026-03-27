import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { canonicalizePublicUrl } from "../src/modules/personas/public-url";

describe("public url canonicalization", () => {
  it("rewrites stale absolute alias urls to the canonical handle", () => {
    assert.equal(
      canonicalizePublicUrl(
        "https://dotly.id/alice-alias",
        "alice-alias",
        "acme",
      ),
      "https://dotly.id/acme",
    );
  });

  it("preserves scoped public routes while rewriting the canonical handle", () => {
    assert.equal(
      canonicalizePublicUrl(
        "https://dotly.one/u/alice-alias",
        "alice-alias",
        "acme",
      ),
      "https://dotly.one/u/acme",
    );
  });
});