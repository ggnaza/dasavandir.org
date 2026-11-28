// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { attestationInviteEmail, safeNextPath } from "./attestation-invite-email.ts";

test("new-account invite links to the set-password URL and lists the subjects", () => {
  const url = "https://x.supabase.co/auth/v1/verify?token=abc&type=invite&redirect_to=https://dasavandir.org/auth/set-password?next=/attestation";
  const e = attestationInviteEmail({ to: "t@example.org", subjects: ["Մաթեմատիկա", "Ֆիզիկա"], url, newAccount: true });
  assert.equal(e.to, "t@example.org");
  assert.ok(e.html.includes("Մաթեմատիկա") && e.html.includes("Ֆիզիկա"));
  assert.ok(e.html.includes("Ստեղծել գաղտնաբառ"));
  assert.ok(e.html.includes(url.replace(/&/g, "&amp;")), "link present, &-escaped for HTML");
});

test("existing-account invite points to the tests page", () => {
  const e = attestationInviteEmail({ to: "t@example.org", subjects: ["Քիմիա"], url: "https://dasavandir.org/attestation", newAccount: false });
  assert.ok(e.html.includes('href="https://dasavandir.org/attestation"'));
  assert.ok(e.html.includes("Բացել թեստերը"));
});

test("subjects are HTML-escaped", () => {
  const e = attestationInviteEmail({ to: "t@example.org", subjects: ['<img src=x onerror="1">'], url: "https://a/b", newAccount: false });
  assert.ok(!e.html.includes("<img src=x"));
  assert.ok(e.html.includes("&lt;img"));
});

test("safeNextPath allows same-site paths only", () => {
  assert.equal(safeNextPath("/attestation"), "/attestation");
  assert.equal(safeNextPath("/attestation?x=1"), "/attestation?x=1");
  assert.equal(safeNextPath("//evil.example"), null);
  assert.equal(safeNextPath("/\\evil.example"), null);
  assert.equal(safeNextPath("https://evil.example"), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath(null), null);
});
