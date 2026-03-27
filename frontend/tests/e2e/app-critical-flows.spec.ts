import { expect, test } from "@playwright/test";

import { ACCESS_TOKEN_COOKIE } from "../../src/lib/auth/constants";
import { E2E_MOCK_ACCESS_TOKEN } from "../../src/lib/e2e/mock-data";

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: E2E_MOCK_ACCESS_TOKEN,
      url: baseURL ?? "http://127.0.0.1:3001",
    },
  ]);

  await page.goto("/app");
  await expect(page).toHaveURL("/app");
});

test("share screen keeps launch-critical QR actions visible", async ({
  page,
}) => {
  await page.goto("/app/qr");

  await expect(page.getByText("Use this in the room")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Invite someone" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open requests" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open inbox" })).toBeVisible();
});

test("requests screen shows incoming and outgoing lanes", async ({ page }) => {
  await page.goto("/app/requests");

  await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Incoming" })).toHaveAttribute(
    "type",
    "button",
  );
  await expect(page.getByText("Noah Patel")).toBeVisible();

  await page.getByRole("button", { name: "Outgoing" }).click();
  await expect(page.getByText("Mia Rivera")).toBeVisible();
});

test("inbox screen renders route-aware triage state", async ({ page }) => {
  await page.goto("/app/inbox");

  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByText("Northline partnership follow-up")).toBeVisible();
  await expect(page.getByRole("button", { name: /Archived ·/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Manage team coverage/i }),
  ).toBeVisible();
});

test("bottom shell keeps the current destination visually anchored", async ({
  page,
}) => {
  await page.goto("/app/requests");

  await expect(
    page.getByText("Keep incoming connections simple and clear."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Requests" })).toHaveAttribute(
    "data-active",
    "true",
  );
});
