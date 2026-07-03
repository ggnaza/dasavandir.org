import { test, expect } from "@playwright/test";
import { TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD } from "./helpers";

// Production = the live domain but NOT the staging subdomain.
const baseUrl = process.env.E2E_BASE_URL ?? "";
const isProduction = baseUrl.includes("dasavandir.org") && !baseUrl.includes("staging");

test("login with wrong password shows error", async ({ page }) => {
  // Skip against production: this negative test submits a bogus login, which
  // records a login_failed audit entry. It's a UI-behavior test — staging and
  // local coverage is enough, and this keeps the prod Activity log clean.
  test.skip(isProduction, "Skipped on production to avoid login_failed audit noise");

  await page.goto("/auth/login");
  await page.fill('input[type="email"]', "someone@example.com");
  await page.fill('input[type="password"]', "wrongpassword");
  await page.click('button[type="submit"]');

  // Should stay on login and show an error — not redirect
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  // Error message should appear once the async auth call returns. Wait for it
  // rather than checking immediately (the response is not instant).
  await expect(
    page.getByText(/invalid|incorrect|wrong|failed|error|սխալ/i).first()
  ).toBeVisible({ timeout: 10000 });
});

test("login with correct credentials reaches /learn", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_LEARNER_EMAIL);
  await page.fill('input[type="password"]', TEST_LEARNER_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/learn/, { timeout: 10000 });
});
