import { test, expect } from "@playwright/test";
import {
  TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD,
  TEST_COURSE_ID, TEST_LESSON_ID,
  TEST_UNENROLLED_COURSE_ID, TEST_UNENROLLED_LESSON_ID,
  loginAs,
} from "./helpers";

test("enrolled user can reach lesson page", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL || !TEST_COURSE_ID || !TEST_LESSON_ID, "E2E env vars not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);
  await page.goto(`/learn/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}`);

  // Should stay on the lesson page, not redirect away
  await expect(page).toHaveURL(`/learn/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}`, { timeout: 10000 });

  // Lesson content area should be present
  await expect(page.locator("h1")).toBeVisible();
});

test("unenrolled user is redirected away from lesson", async ({ page }) => {
  test.skip(!TEST_LEARNER_EMAIL || !TEST_UNENROLLED_COURSE_ID || !TEST_UNENROLLED_LESSON_ID, "E2E env vars not set — skipping");

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);
  await page.goto(`/learn/courses/${TEST_UNENROLLED_COURSE_ID}/lessons/${TEST_UNENROLLED_LESSON_ID}`);

  // Should redirect to the course page, not show the lesson
  await expect(page).not.toHaveURL(
    `/learn/courses/${TEST_UNENROLLED_COURSE_ID}/lessons/${TEST_UNENROLLED_LESSON_ID}`,
    { timeout: 10000 }
  );
  await expect(page).toHaveURL(`/courses/${TEST_UNENROLLED_COURSE_ID}`, { timeout: 10000 });
});
