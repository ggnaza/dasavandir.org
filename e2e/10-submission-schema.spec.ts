import { test, expect } from "@playwright/test";
import { submitSchema, submitErrorMessage, MAX_SUBMISSION_CONTENT_CHARS } from "../lib/submissions/submit-schema";

/**
 * Regression: a learner pasted a long Armenian essay plus a PDF and got a bare
 * "Invalid input" because the submit API capped `content` at 10,000 chars.
 * Pure schema test — needs no server or login.
 */
const base = {
  assignment_id: "11111111-1111-4111-8111-111111111111",
  file_path: "submissions/u/1-ASSISTED.pdf",
  file_name: "ASSISTED.pdf",
  link_url: null,
  group_id: null,
};

test("accepts a long (>10k char) Armenian written response with a file", () => {
  const content = "Մեզ՝ AssistED-ի վեց համահիմնադիրներիս, ".repeat(600); // ~23k chars
  expect(content.length).toBeGreaterThan(10_000);
  expect(submitSchema.safeParse({ ...base, content }).success).toBe(true);
});

test("rejects content over the cap with a readable message, not 'Invalid input'", () => {
  const parsed = submitSchema.safeParse({ ...base, content: "ա".repeat(MAX_SUBMISSION_CONTENT_CHARS + 1) });
  expect(parsed.success).toBe(false);
  if (!parsed.success) expect(submitErrorMessage(parsed.error)).toMatch(/too long/);
});

test("rejects a non-URL link with a readable message", () => {
  const parsed = submitSchema.safeParse({ ...base, content: "hi", link_url: "drive.google.com/x" });
  expect(parsed.success).toBe(false);
  if (!parsed.success) expect(submitErrorMessage(parsed.error)).toMatch(/https:\/\//);
});
