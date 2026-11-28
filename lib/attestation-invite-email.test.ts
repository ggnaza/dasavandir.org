// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { attestationInviteEmail, inviteLinkOrigin, safeNextPath, sessionFromEmailLink } from "./attestation-invite-email.ts";

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

test("safeNextPath rejects tab/newline/backslash tricks the URL parser would strip", () => {
  assert.equal(safeNextPath("/\t/evil.example"), null);
  assert.equal(safeNextPath("/\n/evil.example"), null);
  assert.equal(safeNextPath("/a\\b"), null);
});

test("invite links use our own host, never a spoofed or preview one", () => {
  assert.equal(inviteLinkOrigin("https://staging.dasavandir.org", "https://dasavandir.org"), "https://staging.dasavandir.org");
  assert.equal(inviteLinkOrigin("https://www.dasavandir.org", undefined), "https://www.dasavandir.org");
  assert.equal(inviteLinkOrigin("http://localhost:3000", undefined), "http://localhost:3000");
  assert.equal(inviteLinkOrigin("https://evil.example", "https://dasavandir.org/"), "https://dasavandir.org");
  assert.equal(inviteLinkOrigin("https://x-git-branch.vercel.app", "https://staging.dasavandir.org"), "https://staging.dasavandir.org");
  assert.equal(inviteLinkOrigin("http://dasavandir.org", "https://dasavandir.org"), "https://dasavandir.org");
});

const token = (amr: { method: string }[]) =>
  `h.${Buffer.from(JSON.stringify({ sub: "u", amr })).toString("base64url")}.s`;

test("only sessions opened from an emailed link can self-activate", () => {
  assert.equal(sessionFromEmailLink(token([{ method: "otp" }])), true);
  assert.equal(sessionFromEmailLink(token([{ method: "invite" }])), true);
  assert.equal(sessionFromEmailLink(token([{ method: "recovery" }])), true);
  // A self-signup signed in with a password, or via Google, cannot skip email activation.
  assert.equal(sessionFromEmailLink(token([{ method: "password" }])), false);
  assert.equal(sessionFromEmailLink(token([{ method: "oauth" }])), false);
  assert.equal(sessionFromEmailLink("not-a-jwt"), false);
  assert.equal(sessionFromEmailLink(undefined), false);
});
