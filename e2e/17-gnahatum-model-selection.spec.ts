import { test, expect } from "@playwright/test";
import { getAvailableModels, getCurrentModel, SCORING_MODELS } from "../lib/gnahatum/models";

/**
 * Scoring failed with "No Anthropic API key is configured" on a deployment that
 * had a Gemini key and where the user had picked Gemini in the UI.
 *
 * getCurrentModel() returned the hardcoded claude-sonnet default without
 * checking whether that provider had a key, so /api/gnahatum/models reported
 * `current: "claude-sonnet"` even when no Claude model was offered. The client
 * stored that id, the <select> had no matching <option> (so it displayed the
 * first entry, Gemini, without firing onChange), and claude-sonnet was sent.
 */

const VARS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_AI_API_KEY",
  "OPENAI_API_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

test.beforeEach(() => {
  saved = {};
  for (const v of VARS) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
});

test.afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test("with only a Gemini key, the default model is a Gemini model", () => {
  process.env.GOOGLE_GEMINI_API_KEY = "test-key";

  const current = getCurrentModel();
  expect(
    current.provider,
    "defaulting to Anthropic with no Anthropic key sends every unqualified request to a provider that cannot serve it"
  ).toBe("google");
});

test("the default model is always one that is actually offered", () => {
  process.env.GOOGLE_GEMINI_API_KEY = "test-key";

  const available = getAvailableModels();
  expect(available.length).toBeGreaterThan(0);
  expect(
    available.map((m) => m.id),
    "the id reported as current must appear in the offered list, or the picker cannot show it as selected"
  ).toContain(getCurrentModel().id);
});

test("with only an Anthropic key, the default is a Claude model", () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  expect(getCurrentModel().provider).toBe("anthropic");
});

test("with both keys, Anthropic remains the preferred default", () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.GOOGLE_GEMINI_API_KEY = "test-key";
  expect(getCurrentModel().id).toBe("claude-sonnet");
});

test("with no keys at all, nothing is offered", () => {
  expect(getAvailableModels()).toHaveLength(0);
  // Still returns a model so callers need no null branch; the scorer raises a
  // precise provider-named error from there.
  expect(SCORING_MODELS.map((m) => m.id)).toContain(getCurrentModel().id);
});
