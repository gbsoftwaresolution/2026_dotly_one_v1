import { test, expect } from "@playwright/test";
import { randomEmail, WEB_BASE_URL } from "./helpers/api";
import { registerAndLogin } from "./helpers/auth";
import { apiCreateCardMode, type CardModePublic } from "./helpers/card";

const OWNER_PASSWORD = "TestPassword123!";

test.describe.serial("Personal Card — critical flow", () => {
  test.setTimeout(120_000);

  let owner: {
    email: string;
    accessToken: string;
    refreshToken: string;
  };

  let mode: CardModePublic;

  const visitor = {
    name: "Visitor One",
    email: randomEmail("pw-visitor"),
  };

  test.beforeAll(async () => {
    const email = randomEmail("pw-owner");
    const auth = await registerAndLogin({
      email,
      password: OWNER_PASSWORD,
      displayName: "Playwright Owner",
    });

    owner = {
      email,
      accessToken: auth.session.accessToken,
      refreshToken: auth.session.refreshToken,
    };

    mode = await apiCreateCardMode(owner.accessToken, {
      name: "Playwright Personal",
      slug: "personal",
      headline: "E2E Headline",
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
    });
  });

  test("public card loads and visitor can submit request", async ({ page }) => {
    await page.goto(`/u/${mode.cardPublicId}/${mode.slug}`);

    await expect(page.getByRole("heading", { name: mode.name })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole("heading", { name: "Request access" })).toBeVisible();

    await page.getByPlaceholder("Your name").fill(visitor.name);
    await page.getByPlaceholder("Your email").fill(visitor.email);

    await page.getByRole("button", { name: "Request access" }).click();

    await expect(page.getByText("Request sent")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Status:\s*PENDING/)).toBeVisible();
  });

  test("owner approves; visitor reveals + downloads vCard; revoke blocks", async ({
    browser,
  }) => {
    const visitorContext = await browser.newContext({
      baseURL: WEB_BASE_URL,
      acceptDownloads: true,
    });

    const ownerContext = await browser.newContext({ baseURL: WEB_BASE_URL });
    await ownerContext.addInitScript(
      ([key, tokens]) => {
        localStorage.setItem(key, JSON.stringify(tokens));
      },
      [
        "booster_vault_auth",
        { accessToken: owner.accessToken, refreshToken: owner.refreshToken },
      ],
    );

    const visitorPage = await visitorContext.newPage();
    const ownerPage = await ownerContext.newPage();

    try {
      // Owner opens dashboard and approves the pending request.
      await ownerPage.goto("/apps/card");
      await expect(ownerPage.getByRole("heading", { name: "Card" })).toBeVisible({
        timeout: 60_000,
      });
      await expect(ownerPage.getByText("Requests inbox")).toBeVisible({
        timeout: 60_000,
      });

      // Wait until the request row shows up.
      const requestRow = ownerPage
        .locator("div")
        .filter({ hasText: visitor.email })
        .filter({ has: ownerPage.getByRole("button", { name: "Approve" }) })
        .first();

      await expect(requestRow).toBeVisible({ timeout: 60_000 });
      await requestRow.getByRole("button", { name: "Approve" }).click();

      // Read token (requires explicit "Show").
      await expect(ownerPage.getByText("Approved token (copy once)")).toBeVisible({
        timeout: 60_000,
      });

      await ownerPage.getByTestId("card-grant-toggle").click();

      const token = (await ownerPage.getByTestId("card-grant-token").textContent())
        ?.trim()
        .replace(/\s+/g, " ");

      expect(token, "grant token should be present").toBeTruthy();

      // Visitor reveals contact using token.
      await visitorPage.goto(`/u/${mode.cardPublicId}/${mode.slug}`);
      await visitorPage.getByPlaceholder("Paste access token").fill(token!);

      const revealResPromise = visitorPage.waitForResponse(
        (res) =>
          res.request().method() === "GET" &&
          /\/v1\/card\/public\/.+\/modes\/.+\/contact$/.test(res.url()),
        { timeout: 60_000 },
      );

      await visitorPage.getByRole("button", { name: "Reveal contact" }).click();
      const revealRes = await revealResPromise;
      expect(revealRes.status(), "reveal should succeed").toBe(200);

      await expect(visitorPage.getByText(owner.email)).toBeVisible({
        timeout: 30_000,
      });

      // Download vCard requires the token too.
      const downloadPromise = visitorPage.waitForEvent("download", {
        timeout: 60_000,
      });
      await visitorPage.getByRole("button", { name: "Download vCard" }).click();

      const download = await downloadPromise;
      expect(
        download.suggestedFilename().toLowerCase(),
        "download should be a .vcf file",
      ).toMatch(/\.vcf$/);

      // Revoke instantly blocks.
      ownerPage.once("dialog", (d) => d.accept().catch(() => undefined));
      await ownerPage.getByTestId("card-grant-revoke").click();
      await expect(ownerPage.getByText("Approved token (copy once)")).toBeHidden({
        timeout: 60_000,
      });

      const blockedResPromise = visitorPage.waitForResponse(
        (res) =>
          res.request().method() === "GET" &&
          /\/v1\/card\/public\/.+\/modes\/.+\/contact$/.test(res.url()),
        { timeout: 60_000 },
      );

      await visitorPage.getByRole("button", { name: "Reveal contact" }).click();
      const blockedRes = await blockedResPromise;
      expect(blockedRes.status(), "reveal should be blocked after revoke").toBe(
        401,
      );

      await expect(visitorPage.getByTestId("card-reveal-error")).toBeVisible({
        timeout: 30_000,
      });
      await expect(visitorPage.getByTestId("card-reveal-error")).toHaveText(
        /\S+/, // non-empty
      );
      await expect(
        visitorPage.getByText("Revealed contact"),
      ).toBeHidden();
    } finally {
      await ownerContext.close();
      await visitorContext.close();
    }
  });
});
