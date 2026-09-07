import { test, expect } from "@playwright/test";
import {
  PROVIDER_ENV_NAMES,
  hasProviderKey,
  providerApiKey,
  providerKeyStatus,
} from "../lib/ai-keys";

/**
 * Ararka reported "No AI model is configured" on a deployment that had a
 * working Gemini key, because it checked only GOOGLE_AI_API_KEY — a name
 * nothing else in the codebase used. The rest of the app reads
 * GOOGLE_GEMINI_API_KEY (efficacy) or GOOGLE_API_KEY (lib/llm).
 *
 * These assert every accepted alias resolves, so reintroducing a single
 * hardcoded name fails here.
 */

const GOOGLE_VARS = ["GOOGLE_GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_API_KEY"] as const;
const ALL_VARS = [...GOOGLE_VARS, "ANTHROPIC_API_KEY", "OPENAI_API_KEY"] as const;

let saved: Record<string, string | undefined> = {};

test.beforeEach(() => {
  saved = {};
  for (const v of ALL_VARS) {
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

for (const varName of GOOGLE_VARS) {
  test(`a Gemini key under ${varName} is found`, () => {
    process.env[varName] = "test-key";
    expect(hasProviderKey("google"), `${varName} must satisfy the google provider`).toBe(true);
    expect(providerApiKey("google")).toBe("test-key");
  });
}

test("no google key set means the provider is unavailable", () => {
  expect(hasProviderKey("google")).toBe(false);
  expect(providerApiKey("google")).toBeUndefined();
});

test("google name precedence follows the declared order", () => {
  process.env.GOOGLE_AI_API_KEY = "last";
  process.env.GOOGLE_GEMINI_API_KEY = "first";
  expect(providerApiKey("google")).toBe("first");
});

test("anthropic resolves from ANTHROPIC_API_KEY", () => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  expect(hasProviderKey("anthropic")).toBe(true);
});

test("key lookup reads the environment at call time, not module load", () => {
  expect(hasProviderKey("anthropic")).toBe(false);
  process.env.ANTHROPIC_API_KEY = "set-after-import";
  expect(
    hasProviderKey("anthropic"),
    "a key set after module load must still be seen — otherwise the runtime env is captured too early"
  ).toBe(true);
});

test("status reports presence only, never key material", () => {
  process.env.ANTHROPIC_API_KEY = "super-secret-value";
  const status = providerKeyStatus();
  expect(status).toEqual({ anthropic: true, google: false, openai: false });
  expect(JSON.stringify(status)).not.toContain("super-secret-value");
});

test("every provider declares at least one env var name", () => {
  for (const [provider, names] of Object.entries(PROVIDER_ENV_NAMES)) {
    expect(names.length, `${provider} declares no env var names`).toBeGreaterThan(0);
  }
});
