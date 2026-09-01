import { test, expect } from "@playwright/test";
import {
  TEST_SPACE_MANAGER_EMAIL,
  TEST_SPACE_MANAGER_PASSWORD,
  TEST_SM_COURSE_ID,
  TEST_SM_FOREIGN_COURSE_ID,
  loginAs,
} from "./helpers";

/**
 * Regression guard for the space_manager authorization sweep.
 *
 * Many staff endpoints gated on a coarse role list ["admin","course_creator",
 * "course_manager"] and OMITTED "space_manager", so a space manager got a
 * spurious 403 on courses in their own space even though checkCourseAccess grants
 * them per-course access. These tests assert the two halves of the fix:
 *   1. a space manager reaches a course-scoped staff endpoint for a course IN
 *      one of the spaces they manage (no spurious 403), and
 *   2. the scope still holds — they are 403 on a course OUTSIDE their spaces.
 *
 * All are skipped unless the space_manager fixtures are provided via env, the
 * same pattern the learner/admin guard tests use (see 05-admin-role-guard).
 */
const haveFixtures =
  !!TEST_SPACE_MANAGER_EMAIL && !!TEST_SM_COURSE_ID && !!TEST_SM_FOREIGN_COURSE_ID;

test.describe("space_manager course-scoped authorization", () => {
  test.skip(!haveFixtures, "space_manager E2E fixtures not set — skipping");

  test("reaches moderators list for a course in their space (not 403)", async ({ page }) => {
    await loginAs(page, TEST_SPACE_MANAGER_EMAIL, TEST_SPACE_MANAGER_PASSWORD);
    // GET /api/admin/moderators?course_id=... runs assertCourseOwner, which grants
    // a space manager access to courses whose space_id is in their managed set.
    const res = await page.request.get(
      `/api/admin/moderators?course_id=${TEST_SM_COURSE_ID}`
    );
    expect(res.status(), "space manager should not be 403 on their own space's course").toBe(200);
  });

  test("is still 403 on a course outside their spaces", async ({ page }) => {
    await loginAs(page, TEST_SPACE_MANAGER_EMAIL, TEST_SPACE_MANAGER_PASSWORD);
    const res = await page.request.get(
      `/api/admin/moderators?course_id=${TEST_SM_FOREIGN_COURSE_ID}`
    );
    expect(res.status(), "space manager must not reach a course outside their spaces").toBe(403);
  });

  test("can post an announcement to a course in their space (not 403)", async ({ page }) => {
    await loginAs(page, TEST_SPACE_MANAGER_EMAIL, TEST_SPACE_MANAGER_PASSWORD);
    const res = await page.request.post("/api/announcements", {
      data: {
        course_id: TEST_SM_COURSE_ID,
        title: "E2E space_manager authz probe",
        body: "Automated test — safe to ignore.",
      },
    });
    // The endpoint no longer 403s a space manager on their own course; any
    // non-403 status (200/201/400/500 depending on downstream state) proves the
    // authorization gate itself passed.
    expect(res.status(), "space manager should clear the announcement authz gate").not.toBe(403);
  });

  test("is 403 posting an announcement to a course outside their spaces", async ({ page }) => {
    await loginAs(page, TEST_SPACE_MANAGER_EMAIL, TEST_SPACE_MANAGER_PASSWORD);
    const res = await page.request.post("/api/announcements", {
      data: {
        course_id: TEST_SM_FOREIGN_COURSE_ID,
        title: "E2E space_manager authz probe",
        body: "Automated test — safe to ignore.",
      },
    });
    expect(res.status(), "space manager must be 403 announcing outside their spaces").toBe(403);
  });
});
