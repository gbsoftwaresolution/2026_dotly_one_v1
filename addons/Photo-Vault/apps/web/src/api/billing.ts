import { apiClient } from "./client";
import type {
  BillingPlan,
  CryptoInvoiceResponse,
  CryptoInvoiceStatusResponse,
  StripeCheckoutSessionResponse,
} from "../types/api";

export const billingApi = {
  listPlans: async (): Promise<BillingPlan[]> => {
    return apiClient.get<BillingPlan[]>("/v1/billing/plans");
  },

  createCryptoInvoice: async (
    planCode: string,
  ): Promise<CryptoInvoiceResponse> => {
    return apiClient.post<CryptoInvoiceResponse>(
      "/v1/billing/crypto-invoices",
      { planCode },
    );
  },

  getCryptoInvoiceStatus: async (
    invoiceId: string,
  ): Promise<CryptoInvoiceStatusResponse> => {
    return apiClient.get<CryptoInvoiceStatusResponse>(
      `/v1/billing/crypto-invoices/${invoiceId}`,
    );
  },

  createStripeCheckoutSession: async (
    planCode: string,
  ): Promise<StripeCheckoutSessionResponse> => {
    return apiClient.post<StripeCheckoutSessionResponse>(
      "/v1/billing/stripe-checkout-sessions",
      { planCode },
    );
  },
};
