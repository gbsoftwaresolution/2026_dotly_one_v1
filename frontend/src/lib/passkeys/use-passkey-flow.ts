"use client";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useCallback, useMemo, useState } from "react";

import { authApi } from "@/lib/api";

import { browserSupportsPasskeys, getPasskeyErrorMessage } from "./errors";

type PasskeyFlowKind = "authenticate" | "register";

export function usePasskeyFlow() {
  const [activeFlow, setActiveFlow] = useState<PasskeyFlowKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => browserSupportsPasskeys(), []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const authenticate = useCallback(async (email?: string) => {
    if (!browserSupportsPasskeys()) {
      throw new Error("Passkeys are not supported in this browser.");
    }

    setActiveFlow("authenticate");
    setError(null);

    try {
      const begin = await authApi.beginPasskeyAuthentication(
        email?.trim() ? { email: email.trim() } : undefined,
      );
      const response = await startAuthentication({
        optionsJSON: begin.options,
      });

      return await authApi.verifyPasskeyAuthentication({
        response,
      });
    } catch (flowError) {
      const message = getPasskeyErrorMessage(flowError);
      setError(message);
      throw new Error(message);
    } finally {
      setActiveFlow(null);
    }
  }, []);

  const register = useCallback(async (name?: string) => {
    if (!browserSupportsPasskeys()) {
      throw new Error("Passkeys are not supported in this browser.");
    }

    setActiveFlow("register");
    setError(null);

    try {
      const begin = await authApi.beginPasskeyRegistration(
        name?.trim() ? { name: name.trim() } : undefined,
      );
      const response = await startRegistration({
        optionsJSON: begin.options,
      });

      return await authApi.verifyPasskeyRegistration({
        response,
        ...(name?.trim() ? { name: name.trim() } : {}),
      });
    } catch (flowError) {
      const message = getPasskeyErrorMessage(flowError);
      setError(message);
      throw new Error(message);
    } finally {
      setActiveFlow(null);
    }
  }, []);

  return {
    supported,
    activeFlow,
    isAuthenticating: activeFlow === "authenticate",
    isRegistering: activeFlow === "register",
    error,
    clearError,
    authenticate,
    register,
  };
}
