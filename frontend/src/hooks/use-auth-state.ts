"use client";

import { useEffect, useState } from "react";

import { useAuthSessionContext } from "@/context/AuthSessionContext";
import { authApi } from "@/lib/api";
import {
  createLoadingSessionSnapshot,
  createLoggedOutSessionSnapshot,
} from "@/lib/auth/session";

export function useAuthState() {
  const contextualSession = useAuthSessionContext();
  const [session, setSession] = useState(createLoadingSessionSnapshot);

  useEffect(() => {
    if (contextualSession) {
      setSession(contextualSession);
      return;
    }

    let isActive = true;

    void authApi
      .getSession()
      .then((nextSession) => {
        if (isActive) {
          setSession(nextSession);
        }
      })
      .catch(() => {
        if (isActive) {
          setSession(createLoggedOutSessionSnapshot());
        }
      });

    return () => {
      isActive = false;
    };
  }, [contextualSession]);

  return contextualSession ?? session;
}
