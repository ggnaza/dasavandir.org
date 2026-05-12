import { test, expect } from "@playwright/test";
import { TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD } from "./helpers";

test("login with wrong password shows error", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', "someone@example.com");
  await page.fill('input[type="password"]', "wrongpassword");
  await page.click('button[type="submit"]');

  // Should stay on login and show an error — not redirect
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  // Error message should be visible somewhere on the page
  const errorVisible = await page.getByText(/invalid|incorrect|wrong|failed|error/i).isVisible();
  expect(errorVisible).toBeTruthy();
});

test("login with correct credentials reaches /learn", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_LEARNER_EMAIL);
  await page.fill('input[type="password"]', TEST_LEARNER_PASSWORD);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/learn/, { timeout: 10000 });
});
