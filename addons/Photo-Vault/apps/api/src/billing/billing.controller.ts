import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  BadRequestException,
  UnauthorizedException,
  Req,
  HttpCode,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Request as ExpressRequest } from "express";
import { BillingService } from "./billing.service";
import { ConfigService } from "../config/config.service";
import {
  CreateCryptoInvoiceDto,
  CreateStripeCheckoutSessionDto,
} from "@booster-vault/shared";
import Stripe from "stripe";

@Controller("billing")
export class BillingController {
  private readonly stripe: Stripe;

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {
    // Stripe webhook signature verification requires Stripe SDK.
    // The API key isn't used for signature verification, but Stripe's SDK expects one.
    const apiKey = this.configService.getOptional("STRIPE_SECRET_KEY") ?? "sk_test_dummy";
    this.stripe = new Stripe(apiKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  /**
   * GET /v1/billing/plans
   * Returns exposed billing plans (P6M_25, Y1_100, Y1_199)
   */
  @Get("plans")
  async getPlans() {
    return await this.billingService.getExposedPlans();
  }

  /**
   * POST /v1/billing/crypto/invoices
   * Create a crypto invoice for a plan
   */
  @Post("crypto/invoices")
  @UseGuards(JwtAuthGuard)
  async createCryptoInvoice(
    @Request() req: ExpressRequest,
    @Body() dto: CreateCryptoInvoiceDto,
  ) {
    const userId = (req as any).user?.sub;
    return await this.billingService.createCryptoInvoice(userId, dto.planCode);
  }

  /**
   * GET /v1/billing/crypto/invoices/:invoiceId
   * Get crypto invoice status (ownership enforced)
   */
  @Get("crypto/invoices/:invoiceId")
  @UseGuards(JwtAuthGuard)
  async getCryptoInvoiceStatus(
    @Request() req: ExpressRequest,
    @Param("invoiceId") invoiceId: string,
  ) {
    const userId = (req as any).user?.sub;
    return await this.billingService.getCryptoInvoiceStatus(userId, invoiceId);
  }

  /**
   * POST /v1/billing/crypto/webhook
   * Crypto payment webhook (secured by CRYPTO_WEBHOOK_SECRET)
   */
  @Post("crypto/webhook")
  @Throttle({ "billing-webhook": {} })
  async processCryptoWebhook(
    @Headers("x-crypto-webhook-secret") secret: string,
    @Body() body: { invoiceId: string; txHash: string },
  ) {
    // Verify webhook secret
    if (!secret || secret !== process.env.CRYPTO_WEBHOOK_SECRET) {
      throw new UnauthorizedException("Invalid webhook secret");
    }

    const { invoiceId, txHash } = body;
    if (!invoiceId || !txHash) {
      throw new BadRequestException("Missing invoiceId or txHash");
    }

    await this.billingService.processCryptoWebhook(invoiceId, txHash);
    return { success: true };
  }

  /**
   * POST /v1/billing/stripe/checkout-session
   * Create Stripe checkout session
   */
  @Post("stripe/checkout-session")
  @UseGuards(JwtAuthGuard)
  async createStripeCheckoutSession(
    @Request() req: ExpressRequest,
    @Body() dto: CreateStripeCheckoutSessionDto,
  ) {
    const userId = (req as any).user?.sub;
    return await this.billingService.createStripeCheckoutSession(
      userId,
      dto.planCode,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  /**
   * POST /v1/billing/stripe/webhook
   * Stripe webhook (secured by STRIPE_WEBHOOK_SECRET)
   */
  @Post("stripe/webhook")
  @Throttle({ "billing-webhook": {} })
  @HttpCode(204)
  async processStripeWebhook(
    @Req() req: ExpressRequest,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException("Missing stripe-signature header");
    }

    const rawBody = (req as any).body;
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException(
        "Stripe webhook requires raw body (Buffer). Check body parser configuration.",
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.stripeWebhookSecret,
      ) as Stripe.Event;
    } catch {
      throw new UnauthorizedException("Invalid Stripe webhook signature");
    }

    await this.billingService.processStripeWebhook(event.id, event.type, event);
  }
}
