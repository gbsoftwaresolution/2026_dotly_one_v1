import { useState, useCallback, useEffect } from "react";
import { authApi } from "../api/auth";
import { useAuth } from "../app/AuthProvider";

const SESSION_STORAGE_KEY = "email_verification_cooldown";
const COOLDOWN_DURATION = 60; // seconds

export interface UseEmailVerificationResendResult {
  resend: () => Promise<void>;
  isSending: boolean;
  cooldownSecondsRemaining: number;
  lastResult: { success: boolean; message: string } | null;
}

export const useEmailVerificationResend =
  (): UseEmailVerificationResendResult => {
    const { user, refreshMe } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const [cooldownSecondsRemaining, setCooldownSecondsRemaining] = useState(0);
    const [lastResult, setLastResult] = useState<{
      success: boolean;
      message: string;
    } | null>(null);

    // Load cooldown from sessionStorage on mount
    useEffect(() => {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const cooldownEnd = parseInt(stored, 10);
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, cooldownEnd - now);
        if (remaining > 0) {
          setCooldownSecondsRemaining(remaining);
        } else {
          // Clear expired cooldown
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    }, []);

    // Update countdown timer
    useEffect(() => {
      if (cooldownSecondsRemaining <= 0) return;

      const timer = setInterval(() => {
        setCooldownSecondsRemaining((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(timer);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            return 0;
          }
          return newValue;
        });
      }, 1000);

      return () => clearInterval(timer);
    }, [cooldownSecondsRemaining]);

    const startCooldown = useCallback(() => {
      const cooldownEnd = Math.floor(Date.now() / 1000) + COOLDOWN_DURATION;
      sessionStorage.setItem(SESSION_STORAGE_KEY, cooldownEnd.toString());
      setCooldownSecondsRemaining(COOLDOWN_DURATION);
    }, []);

    const resend = useCallback(async () => {
      if (cooldownSecondsRemaining > 0) {
        setLastResult({
          success: false,
          message: "Please wait before trying again",
        });
        return;
      }

      setIsSending(true);
      setLastResult(null);

      try {
        const current = user?.email ? user : await refreshMe();
        const email = current?.email;

        if (!email) {
          setLastResult({
            success: false,
            message: "Could not load your email. Please refresh and try again.",
          });
          return;
        }

        await authApi.requestEmailVerification(email);

        setLastResult({
          success: true,
          message: "Verification email sent. Check your inbox.",
        });
        startCooldown();
      } catch (error: any) {
        console.error("Failed to send verification email:", error);

        let message = "Could not send. Try again.";
        const status = error?.status ?? error?.response?.status;
        if (status === 429) {
          message = "Please wait before trying again.";
          // Start cooldown on 429 as well
          startCooldown();
        } else if (status === 401 || status === 403) {
          message = "Authentication error. Please log in again.";
        } else if (typeof status === "number" && status >= 500) {
          message = "Server error. Please try again later.";
        }

        setLastResult({ success: false, message });
      } finally {
        setIsSending(false);
      }
    }, [cooldownSecondsRemaining, refreshMe, startCooldown, user]);

    return {
      resend,
      isSending,
      cooldownSecondsRemaining,
      lastResult,
    };
  };
