import { test, expect } from "@playwright/test";

/**
 * Test: email signup shows "Check your email" screen.
 *
 * Uses a random email so it never collides with existing accounts.
 * Does NOT complete activation — just verifies the signup flow up to the
 * confirmation screen.
 */
test("email signup shows check-your-email screen", async ({ page }) => {
  const email = `e2e-${Date.now()}@mailinator.com`;

  await page.goto("/auth/signup");

  await page.fill('input[type="text"]', "E2E Test User");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "TestPassword123!");

  // Accept terms
  await page.check('input[type="checkbox"]');

  await page.click('button[type="submit"]');

  // Should show the "Check your email" confirmation screen
  await expect(page.getByText("Check your email")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("24 hours")).toBeVisible();
});
