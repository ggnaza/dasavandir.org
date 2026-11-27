import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression test: Google SSO must return the user to the origin they started
 * on, never to a build-time-baked host.
 *
 * The bug: `redirectTo` was built from `NEXT_PUBLIC_SITE_URL`, which Next.js
 * inlines at build time. The staging build was made with the production value,
 * so the staging bundle shipped
 *   redirectTo: "https://dasavandir.org/auth/callback"
 * and every SSO sign-in from staging.dasavandir.org landed on production.
 *
 * These tests intercept the outbound Supabase /auth/v1/authorize navigation and
 * assert its `redirect_to` param is on the origin under test. They never leave
 * the app, so no real Google account is involved.
 */

/**
 * Static guard — the unconditional falsifier.
 *
 * The behavioral tests below only catch the bug when NEXT_PUBLIC_SITE_URL
 * differs from the serving origin. In local dev they are equal
 * (.env.local sets it to http://localhost:3000), so the buggy code passes them
 * locally and only fails once deployed to staging. This check has no such blind
 * spot: it fails the moment any OAuth call site reintroduces the build-time env
 * var, regardless of environment.
 */
test("no OAuth call site builds redirectTo from NEXT_PUBLIC_SITE_URL", () => {
  const callSites = [
    "app/auth/login/page.tsx",
    "app/auth/signup/page.tsx",
    "components/auth-modal.tsx",
  ];

  for (const rel of callSites) {
    const src = readFileSync(join(__dirname, "..", rel), "utf8");

    // Anything between `redirectTo` and the end of that line.
    const redirectLines = src
      .split("\n")
      .filter((line) => line.includes("redirectTo"));

    expect(redirectLines.length, `${rel} has no redirectTo`).toBeGreaterThan(0);

    for (const line of redirectLines) {
      expect(
        line,
        `${rel} builds redirectTo from the build-time NEXT_PUBLIC_SITE_URL; ` +
          `use oauthCallbackUrl() so the origin comes from window.location`
      ).not.toContain("NEXT_PUBLIC_SITE_URL");
    }
  }
});

/**
 * Click the Google button and return the `redirect_to` Supabase was handed.
 * The authorize request is aborted so the browser never navigates to Google.
 */
async function captureRedirectTo(page: Page, clickGoogle: () => Promise<void>) {
  let authorizeUrl: string | null = null;

  await page.route("**/auth/v1/authorize*", async (route) => {
    authorizeUrl = route.request().url();
    await route.abort();
  });

  await clickGoogle();

  await expect
    .poll(() => authorizeUrl, {
      message: "expected a Supabase /auth/v1/authorize request",
      timeout: 10000,
    })
    .not.toBeNull();

  const redirectTo = new URL(authorizeUrl!).searchParams.get("redirect_to");
  expect(redirectTo, "authorize call carried no redirect_to").toBeTruthy();
  return new URL(redirectTo!);
}

test("login page SSO redirects back to the current origin", async ({ page, baseURL }) => {
  await page.goto("/auth/login");

  const redirect = await captureRedirectTo(page, () =>
    page.getByRole("button", { name: /sign in with google/i }).click()
  );

  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.pathname).toBe("/auth/callback");
});

test("login page SSO preserves the next param", async ({ page, baseURL }) => {
  await page.goto("/auth/login?next=/ararka");

  const redirect = await captureRedirectTo(page, () =>
    page.getByRole("button", { name: /sign in with google/i }).click()
  );

  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.searchParams.get("next")).toBe("/ararka");
});

test("login page SSO drops a protocol-relative next param", async ({ page, baseURL }) => {
  await page.goto("/auth/login?next=//evil.example.com");

  const redirect = await captureRedirectTo(page, () =>
    page.getByRole("button", { name: /sign in with google/i }).click()
  );

  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.searchParams.get("next")).toBeNull();
});

test("signup page SSO redirects back to the current origin", async ({ page, baseURL }) => {
  await page.goto("/auth/signup");

  const redirect = await captureRedirectTo(page, () =>
    page.getByRole("button", { name: /google/i }).click()
  );

  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.pathname).toBe("/auth/callback");
});

test("landing-page auth modal SSO redirects back to the current origin", async ({ page, baseURL }) => {
  await page.goto("/");

  // Open the modal from the landing page's sign-in entry point.
  await page.getByRole("button", { name: /sign in|մուտք/i }).first().click();

  const redirect = await captureRedirectTo(page, () =>
    page.getByRole("button", { name: /google/i }).click()
  );

  expect(redirect.origin).toBe(new URL(baseURL!).origin);
  expect(redirect.pathname).toBe("/auth/callback");
});
