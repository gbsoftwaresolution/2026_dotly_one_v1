import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { BillingService } from "./billing.service";
import { PLAN_PRICES, PLAN_NAMES, PLAN_FEATURES } from "@booster-vault/shared";
import { CryptoInvoiceStatus, SubscriptionStatus } from "@prisma/client";

// Mock Stripe
const mockStripe = {
  customers: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
};

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

describe("BillingService", () => {
  let service: BillingService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: {
            cryptoInvoice: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditEvent: {
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            subscription: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
            },
            stripeEvent: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            isStripeConfigured: false,
            isCryptoConfigured: false,
            cryptoPaymentAddress: "0x1234567890abcdef",
            billingCurrency: "USD",
            cardProcessingFeePercent: 4,
            stripeSecretKey: "sk_test_123",
            stripeWebhookSecret: "whsec_123",
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getExposedPlans", () => {
    it("should return only exposed plans", async () => {
      const plans = await service.getExposedPlans();

      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.code)).toEqual(["P6M_25", "Y1_100", "Y1_199"]);

      const p6m25 = plans.find((p) => p.code === "P6M_25");
      expect(p6m25).toBeDefined();
      expect(p6m25?.name).toBe(PLAN_NAMES["P6M_25"]);
      expect(p6m25?.priceCents).toBe(PLAN_PRICES["P6M_25"]);
      expect(p6m25?.interval).toBe("month");
      expect(p6m25?.features).toEqual(PLAN_FEATURES["P6M_25"]);
    });
  });

  describe("createCryptoInvoice", () => {
    const userId = "user-123";
    const planCode = "P6M_25";

    beforeEach(() => {
      config.isCryptoConfigured = true;
    });

    it("should create crypto invoice when crypto is configured", async () => {
      const mockInvoice = {
        id: "invoice-123",
        userId,
        planCode,
        baseAmountCents: PLAN_PRICES[planCode],
        currency: "USD",
        paymentAddress: "0x1234567890abcdef",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        status: CryptoInvoiceStatus.PENDING,
      };

      prisma.cryptoInvoice.create.mockResolvedValue(mockInvoice as any);
      prisma.auditEvent.create.mockResolvedValue({} as any);

      const result = await service.createCryptoInvoice(userId, planCode);

      expect(prisma.cryptoInvoice.create).toHaveBeenCalledWith({
        data: {
          userId,
          planCode,
          baseAmountCents: PLAN_PRICES[planCode],
          currency: "USD",
          paymentAddress: "0x1234567890abcdef",
          expiresAt: expect.any(Date),
          status: CryptoInvoiceStatus.PENDING,
        },
      });

      expect(result).toEqual({
        invoiceId: mockInvoice.id,
        amountCents: mockInvoice.baseAmountCents,
        currency: mockInvoice.currency,
        paymentAddress: mockInvoice.paymentAddress,
        expiresAt: mockInvoice.expiresAt.toISOString(),
      });
    });

    it("should throw BadRequestException when crypto is not configured", async () => {
      config.isCryptoConfigured = false;

      await expect(
        service.createCryptoInvoice(userId, planCode),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for non-exposed plan", async () => {
      config.isCryptoConfigured = true;

      await expect(
        service.createCryptoInvoice(userId, "Y5_500" as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getCryptoInvoiceStatus", () => {
    const userId = "user-123";
    const invoiceId = "invoice-123";

    it("should return invoice status for owner", async () => {
      const mockInvoice = {
        id: invoiceId,
        userId,
        baseAmountCents: 2500,
        currency: "USD",
        status: CryptoInvoiceStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        paidAt: null,
        txHash: null,
      };

      prisma.cryptoInvoice.findUnique.mockResolvedValue(mockInvoice as any);

      const result = await service.getCryptoInvoiceStatus(userId, invoiceId);

      expect(prisma.cryptoInvoice.findUnique).toHaveBeenCalledWith({
        where: { id: invoiceId },
      });
      expect(result).toEqual({
        invoiceId: mockInvoice.id,
        status: mockInvoice.status,
        amountCents: mockInvoice.baseAmountCents,
        currency: mockInvoice.currency,
        expiresAt: mockInvoice.expiresAt.toISOString(),
      });
    });

    it("should throw NotFoundException when invoice not found", async () => {
      prisma.cryptoInvoice.findUnique.mockResolvedValue(null);

      await expect(
        service.getCryptoInvoiceStatus(userId, invoiceId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user is not owner", async () => {
      const mockInvoice = {
        id: invoiceId,
        userId: "other-user",
        baseAmountCents: 2500,
        currency: "USD",
        status: CryptoInvoiceStatus.PENDING,
        expiresAt: new Date(),
      };

      prisma.cryptoInvoice.findUnique.mockResolvedValue(mockInvoice as any);

      await expect(
        service.getCryptoInvoiceStatus(userId, invoiceId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Note: More tests would be added for processCryptoWebhook, createStripeCheckoutSession,
  // processStripeWebhook, and other methods. These are basic examples.
});
