import { test, expect } from "@playwright/test";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, loginAs } from "./helpers";

// Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD and E2E_TIMETABLE_COURSE_ID —
// a course the admin owns that has timetable_enabled and at least one entry.
const COURSE_ID = process.env.E2E_TIMETABLE_COURSE_ID ?? "";

test.describe("timetable inline editing", () => {
  test.skip(!TEST_ADMIN_EMAIL || !COURSE_ID, "E2E_ADMIN_EMAIL / E2E_TIMETABLE_COURSE_ID not set — skipping");

  test("editing a title inline persists across a reload", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto(`/admin/courses/${COURSE_ID}/timetable`);

    const title = page.locator('[role="button"][title="Click to edit"]').first();
    await expect(title).toBeVisible({ timeout: 10000 });
    const original = (await title.textContent())?.trim() ?? "";
    const edited = `${original} ✎`;

    await title.click();
    const input = page.locator("input").first();
    await input.fill(edited);
    await input.press("Enter");

    // The row must stop showing "saving…" and the new value must survive a reload,
    // which is what proves the write actually reached the database.
    await expect(page.locator("text=saving…")).toHaveCount(0, { timeout: 10000 });
    await page.reload();
    await expect(page.locator("body")).toContainText(edited, { timeout: 10000 });

    // Restore, so the spec is idempotent against a real course.
    const restored = page.locator('[role="button"][title="Click to edit"]').first();
    await restored.click();
    const restoreInput = page.locator("input").first();
    await restoreInput.fill(original);
    await restoreInput.press("Enter");
    await expect(page.locator("text=saving…")).toHaveCount(0, { timeout: 10000 });
  });

  test("Escape cancels an inline edit without saving", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto(`/admin/courses/${COURSE_ID}/timetable`);

    const title = page.locator('[role="button"][title="Click to edit"]').first();
    await expect(title).toBeVisible({ timeout: 10000 });
    const original = (await title.textContent())?.trim() ?? "";

    await title.click();
    const input = page.locator("input").first();
    await input.fill("THIS MUST NOT PERSIST");
    await input.press("Escape");

    await page.reload();
    await expect(page.locator("body")).not.toContainText("THIS MUST NOT PERSIST");
    await expect(page.locator("body")).toContainText(original);
  });

  test("an empty title is rejected and the original is kept", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto(`/admin/courses/${COURSE_ID}/timetable`);

    const title = page.locator('[role="button"][title="Click to edit"]').first();
    await expect(title).toBeVisible({ timeout: 10000 });
    const original = (await title.textContent())?.trim() ?? "";

    await title.click();
    const input = page.locator("input").first();
    await input.fill("   ");
    await input.press("Enter");

    await expect(page.locator("text=Title cannot be empty.")).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.locator("body")).toContainText(original);
  });
});
