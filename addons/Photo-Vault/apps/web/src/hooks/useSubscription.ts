import { useState, useEffect, useRef } from "react";
import { apiClient } from "../api/client";
import type { UserResponse } from "../types/api";

interface SubscriptionData extends Pick<
  UserResponse,
  "subscriptionStatus" | "currentPlanCode" | "trialEndsAt"
> {
  usage?: {
    mediaCount: number;
    mediaLimit: number;
  };
}

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Prevent multiple fetches on mount/re-render
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchSubscription = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [rawUser, rawUsage, rawSub] = await Promise.all([
          apiClient.get<any>("/v1/me"),
          apiClient.get<any>("/v1/me/usage"),
          apiClient.get<any>("/v1/me/subscription"),
        ]);

        const user: UserResponse = (rawUser?.user ?? rawUser) as UserResponse;
        const usage = (rawUsage?.usage ?? rawUsage) as
          | {
              totalMediaCount?: number;
            }
          | undefined;
        const sub = (rawSub?.subscription ?? rawSub) as
          | {
              trialMediaLimit?: number;
              status?: string;
            }
          | undefined;

        const isTrialStatus =
          user.subscriptionStatus === "TRIAL" || sub?.status === "TRIAL";
        const trialMediaLimit =
          typeof sub?.trialMediaLimit === "number" ? sub.trialMediaLimit : 0;
        const totalMediaCount =
          typeof usage?.totalMediaCount === "number"
            ? usage.totalMediaCount
            : 0;

        setSubscription({
          subscriptionStatus: user.subscriptionStatus,
          currentPlanCode: user.currentPlanCode,
          trialEndsAt: user.trialEndsAt,
          usage:
            isTrialStatus && trialMediaLimit > 0
              ? {
                  mediaCount: totalMediaCount,
                  mediaLimit: trialMediaLimit,
                }
              : undefined,
        });
      } catch (err: any) {
        setError(err.message || "Failed to fetch subscription");
        console.error("Failed to fetch subscription:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rawUser, rawUsage, rawSub] = await Promise.all([
        apiClient.get<any>("/v1/me"),
        apiClient.get<any>("/v1/me/usage"),
        apiClient.get<any>("/v1/me/subscription"),
      ]);
      const user: UserResponse = (rawUser?.user ?? rawUser) as UserResponse;

      const usage = (rawUsage?.usage ?? rawUsage) as
        | {
            totalMediaCount?: number;
          }
        | undefined;
      const sub = (rawSub?.subscription ?? rawSub) as
        | {
            trialMediaLimit?: number;
            status?: string;
          }
        | undefined;

      const isTrialStatus =
        user.subscriptionStatus === "TRIAL" || sub?.status === "TRIAL";
      const trialMediaLimit =
        typeof sub?.trialMediaLimit === "number" ? sub.trialMediaLimit : 0;
      const totalMediaCount =
        typeof usage?.totalMediaCount === "number" ? usage.totalMediaCount : 0;

      setSubscription({
        subscriptionStatus: user.subscriptionStatus,
        currentPlanCode: user.currentPlanCode,
        trialEndsAt: user.trialEndsAt,
        usage:
          isTrialStatus && trialMediaLimit > 0
            ? {
                mediaCount: totalMediaCount,
                mediaLimit: trialMediaLimit,
              }
            : undefined,
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch subscription");
      console.error("Failed to fetch subscription:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    subscription,
    isLoading,
    error,
    refresh,
    isTrial: subscription?.subscriptionStatus === "TRIAL",
    isActive: subscription?.subscriptionStatus === "ACTIVE",
    isPastDue: subscription?.subscriptionStatus === "PAST_DUE",
    isExpired: subscription?.subscriptionStatus === "EXPIRED",
    isCanceled: subscription?.subscriptionStatus === "CANCELED",
    trialDaysRemaining: subscription?.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : undefined,
  };
};
