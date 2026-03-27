"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { userApi } from "@/lib/api/user-api";
import type {
  UserActivationFirstResponseNudge,
  UserActivationNudgeQueue,
} from "@/types/user";

interface ActivationNudgeContextValue {
  firstResponseNudge: UserActivationFirstResponseNudge | null;
  clearQueueNudge: (queue: UserActivationNudgeQueue) => Promise<void>;
}

const ActivationNudgeContext = createContext<ActivationNudgeContextValue | null>(
  null,
);

interface ActivationNudgeProviderProps extends PropsWithChildren {
  initialFirstResponseNudge: UserActivationFirstResponseNudge | null;
}

function toActiveNudge(
  nudge: UserActivationFirstResponseNudge | null | undefined,
) {
  if (!nudge || nudge.clearedAt) {
    return null;
  }

  return nudge;
}

export function ActivationNudgeProvider({
  children,
  initialFirstResponseNudge,
}: ActivationNudgeProviderProps) {
  const [firstResponseNudge, setFirstResponseNudge] =
    useState<UserActivationFirstResponseNudge | null>(() =>
      toActiveNudge(initialFirstResponseNudge),
    );
  const clearingQueueRef = useRef<UserActivationNudgeQueue | null>(null);

  const clearQueueNudge = useCallback(
    async (queue: UserActivationNudgeQueue) => {
      if (
        clearingQueueRef.current === queue ||
        firstResponseNudge?.queue !== queue
      ) {
        return;
      }

      clearingQueueRef.current = queue;

      try {
        await userApi.clearFirstResponseNudge(queue);
        setFirstResponseNudge((current) =>
          current?.queue === queue ? null : current,
        );
      } finally {
        if (clearingQueueRef.current === queue) {
          clearingQueueRef.current = null;
        }
      }
    },
    [firstResponseNudge?.queue],
  );

  return (
    <ActivationNudgeContext.Provider
      value={{ firstResponseNudge, clearQueueNudge }}
    >
      {children}
    </ActivationNudgeContext.Provider>
  );
}

export function useActivationNudgeContext() {
  const context = useContext(ActivationNudgeContext);

  if (!context) {
    throw new Error(
      "useActivationNudgeContext must be used within ActivationNudgeProvider.",
    );
  }

  return context;
}