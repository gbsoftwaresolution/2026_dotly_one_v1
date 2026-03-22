import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  buildPersonaTrustState,
  buildPublicPersonaTrustSignals,
} from "../src/modules/personas/persona-trust";

describe("persona trust", () => {
  it("computes public trust signals from verification flags", () => {
    assert.deepEqual(
      buildPublicPersonaTrustSignals({
        emailVerified: true,
        phoneVerified: false,
        businessVerified: true,
      }),
      {
        isVerified: true,
        isStrongVerified: false,
        isBusinessVerified: true,
      },
    );

    assert.deepEqual(
      buildPublicPersonaTrustSignals({
        emailVerified: true,
        phoneVerified: true,
        businessVerified: false,
      }),
      {
        isVerified: true,
        isStrongVerified: true,
        isBusinessVerified: false,
      },
    );
  });

  it("computes a lightweight deterministic internal trust score", () => {
    assert.equal(
      buildPersonaTrustState({
        emailVerified: false,
        phoneVerified: false,
        businessVerified: false,
      }).trustScore,
      0,
    );

    assert.equal(
      buildPersonaTrustState({
        emailVerified: true,
        phoneVerified: false,
        businessVerified: false,
      }).trustScore,
      40,
    );

    assert.equal(
      buildPersonaTrustState({
        emailVerified: true,
        phoneVerified: true,
        businessVerified: true,
      }).trustScore,
      100,
    );
  });
});