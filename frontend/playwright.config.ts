import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3002/login",
    reuseExistingServer: false,
    cwd: ".",
    env: {
      PORT: "3002",
      E2E_MOCKS: "1",
      NEXT_PUBLIC_E2E_MOCKS: "1",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3002/v1",
    },
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
