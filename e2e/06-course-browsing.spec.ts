import { test, expect } from "@playwright/test";
import { TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD, loginAs } from "./helpers";

test("public courses page loads and shows at least one course", async ({ page }) => {
  await page.goto("/courses");
  await expect(page).toHaveURL(/\/courses/, { timeout: 10000 });
  // At least one course card should be visible
  const cards = page.locator("a[href*='/courses/']");
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
});

test("course detail page loads for enrolled learner", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);
  await page.goto("/courses");

  // Click first course card
  const firstCourse = page.locator("a[href*='/courses/']").first();
  await expect(firstCourse).toBeVisible({ timeout: 10000 });
  await firstCourse.click();

  // Should navigate to a course detail page
  await expect(page).toHaveURL(/\/courses\//, { timeout: 10000 });
  await expect(page.locator("h1")).toBeVisible();
});

test("learn page shows enrolled courses for learner", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL, "E2E_LEARNER_EMAIL not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);
  await expect(page).toHaveURL(/\/learn/, { timeout: 10000 });

  // The learn dashboard should render without error
  await expect(page.locator("body")).not.toContainText("Something went wrong");
  await expect(page.locator("body")).not.toContainText("500");
});
