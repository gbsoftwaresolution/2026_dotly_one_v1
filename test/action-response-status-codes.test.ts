import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { HTTP_CODE_METADATA } from "@nestjs/common/constants";

import { AuthController } from "../src/modules/auth/auth.controller";
import { ContactRequestsController } from "../src/modules/contact-requests/contact-requests.controller";
import { QrController } from "../src/modules/qr/qr.controller";
import { RelationshipsController } from "../src/modules/relationships/relationships.controller";
import { UsersController } from "../src/modules/users/users.controller";

describe("action response status codes", () => {
  it("pins fast action endpoints to HTTP 200", () => {
    const cases = [
      RelationshipsController.prototype.instantConnect,
      RelationshipsController.prototype.instantConnectByUsername,
      QrController.prototype.connectQuickConnectQr,
      ContactRequestsController.prototype.approve,
      ContactRequestsController.prototype.reject,
      UsersController.prototype.resendVerificationEmail,
      UsersController.prototype.changePassword,
      UsersController.prototype.requestMobileOtp,
      UsersController.prototype.verifyMobileOtp,
      AuthController.prototype.resendVerificationEmail,
      AuthController.prototype.changePassword,
      AuthController.prototype.requestMobileOtp,
      AuthController.prototype.verifyMobileOtp,
    ] as const;

    for (const handler of cases) {
      assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, handler), 200);
    }
  });
});