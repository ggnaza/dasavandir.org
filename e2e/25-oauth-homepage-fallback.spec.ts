import { test, expect } from "@playwright/test";

/**
 * Regression: when Supabase rejects an OAuth redirectTo that is not on the project's
 * Redirect URLs list, it sends the user to the Site URL (the homepage) with
 * `?code=…`. The homepage ignored it, so Google sign-in "brought you back to the
 * homepage" signed out (production, 2026-11-28). The homepage must forward the
 * auth params to /auth/callback.
 */
test("homepage forwards a stray OAuth code to /auth/callback", async ({ request }) => {
  const res = await request.get("/?code=abc123", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(res.status());
  const to = new URL(res.headers()["location"]!, "http://x");
  expect(to.pathname).toBe("/auth/callback");
  expect(to.searchParams.get("code")).toBe("abc123");
});

test("homepage forwards an OAuth error so the callback can show it", async ({ request }) => {
  const res = await request.get("/?error=access_denied&error_description=Denied", { maxRedirects: 0 });
  const to = new URL(res.headers()["location"]!, "http://x");
  expect(to.pathname).toBe("/auth/callback");
  expect(to.searchParams.get("error_description")).toBe("Denied");
});

test("homepage keeps a same-site next but drops a protocol-relative one", async ({ request }) => {
  const ok = await request.get("/?code=a&next=/attestation", { maxRedirects: 0 });
  expect(new URL(ok.headers()["location"]!, "http://x").searchParams.get("next")).toBe("/attestation");
  const bad = await request.get("/?code=a&next=//evil.example.com", { maxRedirects: 0 });
  expect(new URL(bad.headers()["location"]!, "http://x").searchParams.get("next")).toBeNull();
});

test("a plain homepage visit is not redirected", async ({ request }) => {
  const res = await request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});
