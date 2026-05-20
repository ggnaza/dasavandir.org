import { Page } from "@playwright/test";

// Credentials for a pre-existing test learner account (must exist in the DB).
// Set via environment variables so they're never committed.
export const TEST_LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL ?? "";
export const TEST_LEARNER_PASSWORD = process.env.E2E_LEARNER_PASSWORD ?? "";

// A course the test learner is enrolled in.
export const TEST_COURSE_ID = process.env.E2E_COURSE_ID ?? "";

// A lesson in that course (first lesson, previous ones all complete).
export const TEST_LESSON_ID = process.env.E2E_LESSON_ID ?? "";

// A second lesson the learner has NOT completed yet (for sequential gate test).
export const TEST_LESSON2_ID = process.env.E2E_LESSON2_ID ?? "";

// A course the test learner is NOT enrolled in.
export const TEST_UNENROLLED_COURSE_ID = process.env.E2E_UNENROLLED_COURSE_ID ?? "";
export const TEST_UNENROLLED_LESSON_ID = process.env.E2E_UNENROLLED_LESSON_ID ?? "";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/learn|\/admin/, { timeout: 10000 });
}
