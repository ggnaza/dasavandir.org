import { test, expect } from "@playwright/test";
import { SCORING_MODELS } from "../lib/ararka/models";
import { AI_MODELS } from "../lib/ai-models";

/**
 * Gemini scoring failed with:
 *   404 models/gemini-2.5-flash-preview-05-20 is not found for API version
 *   v1beta, or is not supported for generateContent
 *
 * Ararka carried its own copy of the Gemini model ids, pinned to dated preview
 * builds that Google has since retired. lib/llm.ts already listed one of those
 * exact ids in its DEPRECATED_MODELS map — Ararka simply never consulted it.
 *
 * These keep Ararka's ids aligned with the list the working LMS chat uses.
 */

const araGoogle = SCORING_MODELS.filter((m) => m.provider === "google");
const lmsGoogle = AI_MODELS.filter((m) => m.provider === "Google").map((m) => m.id as string);

test("ararka offers at least one Gemini model", () => {
  expect(araGoogle.length).toBeGreaterThan(0);
});

test("every ararka Gemini id is one the LMS also uses", () => {
  for (const m of araGoogle) {
    expect(
      lmsGoogle,
      `${m.id} pins "${m.model}", which is not in lib/ai-models.ts — the LMS list is the one known to work`
    ).toContain(m.model);
  }
});

test("no scoring model pins a dated preview build", () => {
  for (const m of SCORING_MODELS) {
    expect(
      m.model,
      `${m.id} pins the preview build "${m.model}"; Google retires these and the API then 404s`
    ).not.toMatch(/-preview-\d/);
  }
});

test("model ids are unique", () => {
  const ids = SCORING_MODELS.map((m) => m.id);
  expect(new Set(ids).size).toBe(ids.length);
});
