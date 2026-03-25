import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import request from "supertest";
import express from "express";
import crypto from "crypto";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { ConfigService } from "../config/config.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

describe("BillingController (Stripe webhook signature)", () => {
  let app: INestApplication;

  const stripeSecretKey = "sk_test_dummy";
  const stripeWebhookSecret = "whsec_test_dummy_secret";

  const mockBillingService = {
    processStripeWebhook: jest.fn(),
  };

  const mockConfigService = {
    stripeSecretKey,
    stripeWebhookSecret,
    getOptional: (key: string) => {
      if (key === "STRIPE_SECRET_KEY") return stripeSecretKey;
      return undefined;
    },
  };

  function signStripePayload(
    payload: string,
    secret: string,
    timestamp: number,
  ) {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    return `t=${timestamp},v1=${signature}`;
  }

  beforeEach(async () => {
    mockBillingService.processStripeWebhook.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    // Mirror apps/api/src/main.ts behavior for this route.
    app = moduleRef.createNestApplication({ bodyParser: false });

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      "/v1/billing/stripe/webhook",
      express.raw({ type: "application/json" }),
    );

    const jsonParser = express.json({ limit: "1mb" });
    expressApp.use((req: any, res: any, next: any) => {
      const url: string = req?.originalUrl ?? "";
      if (
        req?.method === "POST" &&
        (url === "/v1/billing/stripe/webhook" ||
          url.startsWith("/v1/billing/stripe/webhook?"))
      ) {
        return next();
      }
      return jsonParser(req, res, next);
    });

    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("accepts a valid Stripe signature and returns 204", async () => {
    const payload = JSON.stringify({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123" } },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = signStripePayload(
      payload,
      stripeWebhookSecret,
      timestamp,
    );

    await request(app.getHttpServer())
      .post("/v1/billing/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signatureHeader)
      .send(payload)
      .expect(204);

    expect(mockBillingService.processStripeWebhook).toHaveBeenCalledTimes(1);
    expect(mockBillingService.processStripeWebhook).toHaveBeenCalledWith(
      "evt_test_123",
      "checkout.session.completed",
      expect.any(Object),
    );
  });

  it("rejects missing signature header with 401 and does not call service", async () => {
    const payload = JSON.stringify({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123" } },
    });

    await request(app.getHttpServer())
      .post("/v1/billing/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(401);

    expect(mockBillingService.processStripeWebhook).not.toHaveBeenCalled();
  });

  it("rejects invalid signature with 401 and does not call service", async () => {
    const payload = JSON.stringify({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123" } },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = signStripePayload(
      payload,
      "whsec_wrong_secret",
      timestamp,
    );

    await request(app.getHttpServer())
      .post("/v1/billing/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", signatureHeader)
      .send(payload)
      .expect(401);

    expect(mockBillingService.processStripeWebhook).not.toHaveBeenCalled();
  });
});
