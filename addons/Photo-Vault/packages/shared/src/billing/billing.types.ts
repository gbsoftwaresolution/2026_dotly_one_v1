/**
 * Billing types for Booster Vault
 */

export interface BillingPlan {
  code: string;
  name: string;
  priceCents: number;
  interval: 'month' | 'year';
  features: string[];
}

export interface CryptoInvoiceResponse {
  invoiceId: string;
  amountCents: number;
  currency: string;
  paymentAddress: string;
  expiresAt: string;
}

export interface CryptoInvoiceStatusResponse {
  invoiceId: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amountCents: number;
  currency: string;
  expiresAt: string;
  paidAt?: string;
  txHash?: string;
}

export interface StripeCheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

// Plan codes that are exposed via API
export type ExposedPlanCode = 'P6M_25' | 'Y1_100' | 'Y1_199';
// All plan codes (including internal ones)
export type PlanCode = ExposedPlanCode | 'Y5_500' | 'Y1_1000';

// Plan price mapping (in cents)
export const PLAN_PRICES: Record<PlanCode, number> = {
  P6M_25: 2500,    // $25.00
  Y1_100: 10000,   // $100.00
  Y1_199: 19900,   // $199.00
  Y5_500: 50000,   // $500.00 (internal only)
  Y1_1000: 100000, // $1000.00 (internal only)
};

// Plan duration mapping (in months)
export const PLAN_DURATIONS: Record<PlanCode, number> = {
  P6M_25: 6,
  Y1_100: 12,
  Y1_199: 12,
  Y5_500: 60,
  Y1_1000: 12,
};

// Plan display names
export const PLAN_NAMES: Record<PlanCode, string> = {
  P6M_25: '6 Months',
  Y1_100: '1 Year (Basic)',
  Y1_199: '1 Year (Premium)',
  Y5_500: '5 Years',
  Y1_1000: '1 Year (Enterprise)',
};

// Plan features
export const PLAN_FEATURES: Record<PlanCode, string[]> = {
  P6M_25: [
    'Unlimited photo storage',
    'Unlimited video storage',
    'Client-side encryption',
    'Album organization',
    'Timeline view',
    'Basic search',
    'Export capabilities',
  ],
  Y1_100: [
    'All 6-month features',
    'Priority support',
    'Extended export retention',
    'Advanced search filters',
  ],
  Y1_199: [
    'All 1-year features',
    'Faster export processing',
    'Custom album covers',
    'Bulk operations',
  ],
  Y5_500: [
    'All premium features',
    '5-year commitment discount',
    'Dedicated support',
    'Custom storage regions',
  ],
  Y1_1000: [
    'All enterprise features',
    'Custom integrations',
    'SLA guarantee',
    'Account management',
  ],
};