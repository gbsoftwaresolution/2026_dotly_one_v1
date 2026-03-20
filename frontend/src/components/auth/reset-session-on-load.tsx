"use client";

import { useEffect } from "react";

import { authApi } from "@/lib/api";

interface ResetSessionOnLoadProps {
  enabled: boolean;
}

export function ResetSessionOnLoad({ enabled }: ResetSessionOnLoadProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    void authApi.logout();
  }, [enabled]);

  return null;
}
