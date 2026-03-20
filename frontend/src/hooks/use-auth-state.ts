"use client";

import { useEffect, useState } from "react";

import { authApi } from "@/lib/api";
import {
  createLoadingSessionSnapshot,
  createLoggedOutSessionSnapshot,
} from "@/lib/auth/session";

export function useAuthState() {
  const [session, setSession] = useState(createLoadingSessionSnapshot);

  useEffect(() => {
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
  }, []);

  return session;
}
