import { Page } from "@playwright/test";

// Credentials for a pre-existing test learner account (must exist in the DB).
// Set via environment variables so they're never committed.
export const TEST_LEARNER_EMAIL = process.env.E2E_LEARNER_EMAIL ?? "";
export const TEST_LEARNER_PASSWORD = process.env.E2E_LEARNER_PASSWORD ?? "";

// Credentials for a pre-existing test admin account.
export const TEST_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

// A course the test learner is enrolled in.
export const TEST_COURSE_ID = process.env.E2E_COURSE_ID ?? "";

// A lesson in that course (first lesson, previous ones all complete).
export const TEST_LESSON_ID = process.env.E2E_LESSON_ID ?? "";

// A second lesson the learner has NOT completed yet (for sequential gate test).
export const TEST_LESSON2_ID = process.env.E2E_LESSON2_ID ?? "";

// A course the test learner is NOT enrolled in.
export const TEST_UNENROLLED_COURSE_ID = process.env.E2E_UNENROLLED_COURSE_ID ?? "";
export const TEST_UNENROLLED_LESSON_ID = process.env.E2E_UNENROLLED_LESSON_ID ?? "";

// Credentials for a pre-existing space_manager account, plus a course that IS in
// one of the spaces they manage and a course that is NOT. Used to verify the
// space_manager authorization sweep: they reach course-scoped staff endpoints for
// their own space's courses but stay 403 on courses outside their spaces.
export const TEST_SPACE_MANAGER_EMAIL = process.env.E2E_SPACE_MANAGER_EMAIL ?? "";
export const TEST_SPACE_MANAGER_PASSWORD = process.env.E2E_SPACE_MANAGER_PASSWORD ?? "";
export const TEST_SM_COURSE_ID = process.env.E2E_SM_COURSE_ID ?? "";
export const TEST_SM_FOREIGN_COURSE_ID = process.env.E2E_SM_FOREIGN_COURSE_ID ?? "";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/learn|\/admin/, { timeout: 10000 });
}
