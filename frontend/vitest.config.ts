import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/app/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        statements: 45,
      },
    },
  },
});
