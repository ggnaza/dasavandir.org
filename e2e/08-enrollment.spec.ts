import { test, expect } from "@playwright/test";
import {
  TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD,
  TEST_COURSE_ID,
  loginAs,
} from "./helpers";

test("enrolled course appears on learn dashboard", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL || !TEST_COURSE_ID, "E2E env vars not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);

  // The learn page should contain a link to the enrolled course
  await expect(page.locator(`a[href*='${TEST_COURSE_ID}']`)).toBeVisible({ timeout: 10000 });
});

test("enrollment API rejects unauthenticated request", async ({ page }) => {
  const response = await page.request.post("/api/enrollments/enroll", {
    data: { courseId: "some-course-id" },
  });
  expect([401, 403]).toContain(response.status());
});
