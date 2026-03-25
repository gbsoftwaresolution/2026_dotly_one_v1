import type { PlanCode, SubscriptionStatus } from "@prisma/client";

export function isPremium(subscription: {
  status: SubscriptionStatus;
  plan: PlanCode;
}): boolean {
  // MVP rule: any ACTIVE subscription is premium.
  // Future: refine based on plan codes.
  return subscription.status === "ACTIVE";
}
