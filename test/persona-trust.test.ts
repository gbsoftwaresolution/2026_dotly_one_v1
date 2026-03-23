import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { buildPublicPersonaTrustSignals } from "../src/modules/personas/persona-trust";

describe("persona trust", () => {
  it("derives public trust signals from synchronized verification state", () => {
    assert.deepEqual(
      buildPublicPersonaTrustSignals({
        emailVerified: true,
        phoneVerified: true,
        businessVerified: true,
      }),
      {
        isVerified: true,
        isStrongVerified: true,
        isBusinessVerified: true,
      },
    );

    assert.deepEqual(
      buildPublicPersonaTrustSignals({
        emailVerified: false,
        phoneVerified: false,
        businessVerified: false,
      }),
      {
        isVerified: false,
        isStrongVerified: false,
        isBusinessVerified: false,
      },
    );

    assert.deepEqual(
      buildPublicPersonaTrustSignals({
        emailVerified: true,
        phoneVerified: false,
      }),
      {
        isVerified: true,
        isStrongVerified: false,
        isBusinessVerified: false,
      },
    );
  });
});
