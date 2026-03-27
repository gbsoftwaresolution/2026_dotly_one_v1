"use client";

import { useEffect } from "react";

import { register } from "@/instrumentation-client";

export function RuntimeErrorListener() {
  useEffect(() => {
    register();
  }, []);

  return null;
}
