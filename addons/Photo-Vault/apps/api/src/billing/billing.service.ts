import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { Prisma } from "@prisma/client";
import {
  BillingPlan,
  CryptoInvoiceResponse,
  CryptoInvoiceStatusResponse,
  StripeCheckoutSessionResponse,
  PLAN_PRICES,
  PLAN_DURATIONS,
  PLAN_NAMES,
  PLAN_FEATURES,
  ExposedPlanCode,
} from "@booster-vault/shared";
import { CryptoInvoiceStatus, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Stripe if configured
    if (this.configService.isStripeConfigured) {
      this.stripe = new Stripe(this.configService.stripeSecretKey, {
        apiVersion: "2025-02-24.acacia",
      });
    }
  }

  /**
   * Get exposed billing plans (only P6M_25, Y1_100, Y1_199)
   */
  async getExposedPlans(): Promise<BillingPlan[]> {
    const exposedPlanCodes: ExposedPlanCode[] = ["P6M_25", "Y1_100", "Y1_199"];

    return exposedPlanCodes.map((code) => ({
      code,
      name: PLAN_NAMES[code],
      priceCents: PLAN_PRICES[code],
      interval: code.includes("M") ? ("month" as const) : ("year" as const),
      features: PLAN_FEATURES[code],
    }));
  }

  /**
   * Create a crypto invoice for a plan
   */
  async createCryptoInvoice(
    userId: string,
    planCode: ExposedPlanCode,
  ): Promise<CryptoInvoiceResponse> {
    // Check if billing is disabled via kill switch
    if (this.configService.disableBilling) {
      throw new ForbiddenException(
        "Billing operations are temporarily disabled for maintenance",
      );
    }

    // Validate plan is allowed
    if (!["P6M_25", "Y1_100", "Y1_199"].includes(planCode)) {
      throw new BadRequestException(
        `Plan ${planCode} is not available for crypto payments`,
      );
    }

    // Check if crypto is configured
    if (!this.configService.isCryptoConfigured) {
      throw new BadRequestException("Crypto payments are not configured");
    }

    // Calculate amount
    const baseAmountCents = PLAN_PRICES[planCode];

    // Create invoice
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now

    const invoice = await this.prisma.cryptoInvoice.create({
      data: {
        userId,
        planCode,
        baseAmountCents,
        currency: this.configService.billingCurrency,
        paymentAddress: this.configService.cryptoPaymentAddress,
        expiresAt,
        status: CryptoInvoiceStatus.PENDING,
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "CRYPTO_INVOICE_CREATED",
        entityType: "CRYPTO_INVOICE",
        entityId: invoice.id,
        meta: {
          planCode,
          amountCents: baseAmountCents,
          currency: this.configService.billingCurrency,
          expiresAt,
        },
      },
    });

    return {
      invoiceId: invoice.id,
      amountCents: invoice.baseAmountCents,
      currency: invoice.currency,
      paymentAddress: invoice.paymentAddress,
      expiresAt: invoice.expiresAt.toISOString(),
    };
  }

  /**
   * Get crypto invoice status
   */
  async getCryptoInvoiceStatus(
    userId: string,
    invoiceId: string,
  ): Promise<CryptoInvoiceStatusResponse> {
    const invoice = await this.prisma.cryptoInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this invoice");
    }

    return {
      invoiceId: invoice.id,
      status: invoice.status,
      amountCents: invoice.baseAmountCents,
      currency: invoice.currency,
      expiresAt: invoice.expiresAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      txHash: invoice.txHash || undefined,
    };
  }

  /**
   * Process crypto webhook (mark invoice as paid)
   */
  async processCryptoWebhook(invoiceId: string, txHash: string): Promise<void> {
    // Idempotency check
    const invoice = await this.prisma.cryptoInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status === CryptoInvoiceStatus.PAID) {
      // Already processed, idempotent
      return;
    }

    if (invoice.status !== CryptoInvoiceStatus.PENDING) {
      throw new BadRequestException(
        `Invoice is in ${invoice.status} state, cannot mark as paid`,
      );
    }

    if (invoice.expiresAt < new Date()) {
      // Mark as expired if not already
      await this.prisma.cryptoInvoice.update({
        where: { id: invoiceId },
        data: { status: CryptoInvoiceStatus.EXPIRED },
      });
      throw new BadRequestException("Invoice has expired");
    }

    // Update invoice and activate subscription in transaction
    await this.prisma.$transaction(async (tx) => {
      // Mark invoice as paid
      await tx.cryptoInvoice.update({
        where: { id: invoiceId },
        data: {
          status: CryptoInvoiceStatus.PAID,
          txHash,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Activate or extend subscription - planCode validated at invoice creation
      await this.activateOrExtendSubscription(
        tx,
        invoice.userId,
        invoice.planCode as ExposedPlanCode,
        "CRYPTO",
        invoice.id,
      );

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId: invoice.userId,
          eventType: "CRYPTO_INVOICE_PAID",
          entityType: "CRYPTO_INVOICE",
          entityId: invoiceId,
          meta: { txHash, planCode: invoice.planCode },
        },
      });
    });
  }

  /**
   * Create Stripe checkout session
   */
  async createStripeCheckoutSession(
    userId: string,
    planCode: ExposedPlanCode,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeCheckoutSessionResponse> {
    if (!this.stripe) {
      throw new BadRequestException("Stripe payments are not configured");
    }

    // Get user to create/retrieve Stripe customer
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Calculate amounts
    const baseAmountCents = PLAN_PRICES[planCode];
    const feePercent = this.configService.cardProcessingFeePercent;
    const feeAmountCents = Math.round(baseAmountCents * (feePercent / 100));
    const totalAmountCents = baseAmountCents + feeAmountCents;

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.subscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;

      // Update subscription with Stripe customer ID
      await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customer.id,
        },
        update: {
          stripeCustomerId: customer.id,
        },
      });
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: this.configService.billingCurrency.toLowerCase(),
            unit_amount: totalAmountCents,
            product_data: {
              name: `${PLAN_NAMES[planCode]} Plan`,
              description: `Booster Vault ${PLAN_NAMES[planCode]} subscription`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        planCode,
        baseAmountCents: baseAmountCents.toString(),
        feeAmountCents: feeAmountCents.toString(),
        totalAmountCents: totalAmountCents.toString(),
        feePercent: feePercent.toString(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "STRIPE_CHECKOUT_SESSION_CREATED",
        entityType: "STRIPE_SESSION",
        entityId: session.id,
        meta: {
          planCode,
          baseAmountCents,
          feeAmountCents,
          totalAmountCents,
          successUrl,
          cancelUrl,
        },
      },
    });

    return {
      checkoutUrl: session.url || "",
      sessionId: session.id,
    };
  }

  /**
   * Process Stripe webhook event (idempotent)
   */
  async processStripeWebhook(
    eventId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    // Idempotency check
    const existingEvent = await this.prisma.stripeEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent?.processed) {
      // Already processed
      return;
    }

    // Store event for idempotency
    const stripeEvent = await this.prisma.stripeEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        type: eventType,
        payload,
      },
      update: {
        type: eventType,
        payload,
      },
    });

    // Process specific event types
    if (eventType === "checkout.session.completed") {
      await this.handleStripeCheckoutSessionCompleted(payload, stripeEvent.id);
    } else if (eventType === "charge.refunded") {
      await this.handleStripeChargeRefunded(payload, stripeEvent.id);
    }

    // Mark as processed
    await this.prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Handle Stripe checkout.session.completed event
   */
  private async handleStripeCheckoutSessionCompleted(
    payload: any,
    stripeEventId: string,
  ): Promise<void> {
    const session = payload.data.object;
    const { userId, planCode } = session.metadata;

    if (!userId || !planCode) {
      throw new BadRequestException(
        "Missing userId or planCode in session metadata",
      );
    }

    // Validate plan code
    if (!["P6M_25", "Y1_100", "Y1_199"].includes(planCode)) {
      throw new BadRequestException(`Invalid plan code: ${planCode}`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Activate or extend subscription
      await this.activateOrExtendSubscription(
        tx,
        userId,
        planCode as ExposedPlanCode,
        "STRIPE",
        stripeEventId,
      );

      // Update subscription with Stripe subscription ID if present
      if (session.subscription) {
        await tx.subscription.update({
          where: { userId },
          data: {
            stripeSubscriptionId: session.subscription,
          },
        });
      }

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "STRIPE_PAYMENT_COMPLETED",
          entityType: "STRIPE_SESSION",
          entityId: session.id,
          meta: {
            planCode,
            amountTotal: session.amount_total,
            currency: session.currency,
            stripeEventId,
          },
        },
      });
    });
  }

  /**
   * Handle Stripe charge.refunded event (chargeback)
   */
  private async handleStripeChargeRefunded(
    payload: any,
    stripeEventId: string,
  ): Promise<void> {
    const charge = payload.data.object;
    const { userId } = charge.metadata;

    if (!userId) {
      // Try to find user via subscription's stripeCustomerId
      const subscription = await this.prisma.subscription.findFirst({
        where: { stripeCustomerId: charge.customer },
      });

      if (!subscription) {
        throw new BadRequestException("Could not find subscription for charge");
      }

      await this.handleChargeback(
        subscription.userId,
        charge.id,
        stripeEventId,
      );
    } else {
      await this.handleChargeback(userId, charge.id, stripeEventId);
    }
  }

  /**
   * Handle chargeback by setting subscription to PAST_DUE
   */
  private async handleChargeback(
    userId: string,
    chargeId: string,
    stripeEventId: string,
  ): Promise<void> {
    await this.prisma.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        updatedAt: new Date(),
      },
    });

    // Create audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "CHARGEBACK_RECEIVED",
        entityType: "STRIPE_CHARGE",
        entityId: chargeId,
        meta: { stripeEventId },
      },
    });
  }

  /**
   * Activate or extend a user's subscription
   */
  private async activateOrExtendSubscription(
    prisma: Prisma.TransactionClient,
    userId: string,
    planCode: ExposedPlanCode,
    _paymentMethod: "CRYPTO" | "STRIPE",
    _paymentReference: string,
  ): Promise<void> {
    // Get or create subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    const now = new Date();
    const durationMonths = PLAN_DURATIONS[planCode];

    if (!subscription) {
      // Create new subscription
      await prisma.subscription.create({
        data: {
          userId,
          status: SubscriptionStatus.ACTIVE,
          plan: planCode,
          currentPeriodStart: now,
          currentPeriodEnd: this.addMonths(now, durationMonths),
          trialEndsAt: null, // End trial if exists
        },
      });
    } else {
      // Extend existing subscription
      const newPeriodEnd =
        subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
          ? this.addMonths(subscription.currentPeriodEnd, durationMonths) // Extend from current end
          : this.addMonths(now, durationMonths); // Start from now if expired

      await prisma.subscription.update({
        where: { userId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          plan: planCode,
          currentPeriodStart: subscription.currentPeriodStart || now,
          currentPeriodEnd: newPeriodEnd,
          trialEndsAt: null, // End trial if exists
          cancelAtPeriodEnd: false, // Reset cancel flag
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Helper: Add months to a date
   */
  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}
