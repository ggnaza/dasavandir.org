import { test, expect } from "@playwright/test";
import { TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD, loginAs } from "./helpers";

/**
 * Test: a learner hitting an admin API route gets 403, not 200 or 500.
 *
 * This catches the regression where a new admin route is added without
 * a role check and any logged-in user can call it.
 */
test("learner gets 403 on admin courses API", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);

  const response = await page.request.get("/api/admin/courses");
  expect(response.status()).toBe(403);
});

test("learner gets 403 on admin users API", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);

  const response = await page.request.get("/api/admin/users");
  expect(response.status()).toBe(403);
});

test("learner gets 403 on admin settings API", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);

  const response = await page.request.get("/api/admin/settings");
  expect(response.status()).toBe(403);
});

test("unauthenticated request gets 401 on admin API", async ({ page }) => {
  const response = await page.request.get("/api/admin/courses");
  // Middleware redirects to login for page routes but API routes return 401/403
  expect([401, 403]).toContain(response.status());
});
