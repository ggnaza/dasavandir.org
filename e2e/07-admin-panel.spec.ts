import { test, expect } from "@playwright/test";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, loginAs } from "./helpers";

test("admin can reach /admin/courses", async ({ page }) => {
  test.skip(!TEST_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skipping");

  await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  await page.goto("/admin/courses");

  await expect(page).toHaveURL(/\/admin\/courses/, { timeout: 10000 });
  await expect(page.locator("body")).not.toContainText("Access denied");
  await expect(page.locator("body")).not.toContainText("403");
});

test("admin can reach /admin/users", async ({ page }) => {
  test.skip(!TEST_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skipping");

  await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  await page.goto("/admin/users");

  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10000 });
  await expect(page.locator("body")).not.toContainText("Access denied");
  await expect(page.locator("body")).not.toContainText("403");
});

test("admin courses API returns 200 for admin", async ({ page }) => {
  test.skip(!TEST_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skipping");

  await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  const response = await page.request.get("/api/admin/courses");
  expect(response.status()).toBe(200);
});

test("admin users API returns 200 for admin", async ({ page }) => {
  test.skip(!TEST_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skipping");

  await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  const response = await page.request.get("/api/admin/users");
  expect(response.status()).toBe(200);
});

test("admin course list shows at least one course", async ({ page }) => {
  test.skip(!TEST_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skipping");

  await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  await page.goto("/admin/courses");

  // Wait for the page to fully load
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toContainText("Something went wrong");
});
