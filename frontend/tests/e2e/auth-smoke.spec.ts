import { expect, test } from "@playwright/test";

import { ACCESS_TOKEN_COOKIE } from "../../src/lib/auth/constants";
import { E2E_MOCK_ACCESS_TOKEN } from "../../src/lib/e2e/mock-data";

test("public auth entry points stay launch-ready", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/signup?ref=ava2026");

  await expect(
    page.getByRole("heading", { name: "Claim your identity." }),
  ).toBeVisible();
  await expect(
    page.getByText("Invite code AVA2026 is already applied."),
  ).toBeVisible();

  await page.goto("/login?email=ava%40dotly.one&created=1&delivery=sent");

  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByText(/Account created\./)).toBeVisible();

  await context.addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: E2E_MOCK_ACCESS_TOKEN,
      url: baseURL ?? "http://127.0.0.1:3001",
    },
  ]);

  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: /your first intro landed, ava/i }),
  ).toBeVisible();
});
