import { test, expect } from "@playwright/test";
import {
  TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD,
  TEST_COURSE_ID, TEST_LESSON_ID, TEST_LESSON2_ID,
  loginAs,
} from "./helpers";

/**
 * Test: sequential learning gate blocks lesson 2 if lesson 1 is not complete.
 *
 * Requires E2E_LESSON2_ID to point to a lesson where lesson 1 (E2E_LESSON_ID)
 * is NOT yet completed by the test learner. Reset lesson 1 progress before
 * running if needed.
 */
test("sequential gate redirects to incomplete earlier lesson", async ({ page }) => {
  test.skip(
    !TEST_LEARNER_EMAIL || !TEST_COURSE_ID || !TEST_LESSON_ID || !TEST_LESSON2_ID,
    "E2E env vars not set — skipping"
  );

  await loginAs(page, TEST_LEARNER_EMAIL, TEST_LEARNER_PASSWORD);

  // Try to jump directly to lesson 2
  await page.goto(`/learn/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON2_ID}`);

  // Should be redirected to lesson 1 (or another earlier incomplete lesson), not stay on lesson 2
  await expect(page).not.toHaveURL(
    `/learn/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON2_ID}`,
    { timeout: 10000 }
  );
  await expect(page).toHaveURL(
    `/learn/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}`,
    { timeout: 10000 }
  );
});
