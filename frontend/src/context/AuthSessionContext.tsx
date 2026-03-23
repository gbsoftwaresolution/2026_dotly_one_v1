"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";

import type { SessionSnapshot } from "@/types/auth";

const AuthSessionContext = createContext<SessionSnapshot | null>(null);

interface AuthSessionProviderProps extends PropsWithChildren {
  session: SessionSnapshot;
}

export function AuthSessionProvider({
  children,
  session,
}: AuthSessionProviderProps) {
  return (
    <AuthSessionContext.Provider value={session}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSessionContext() {
  return useContext(AuthSessionContext);
}