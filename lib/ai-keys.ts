/**
 * Canonical AI provider API keys.
 *
 * The codebase accumulated three different names for the same Google key
 * (GOOGLE_GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_AI_API_KEY). Gnahatum checked
 * only GOOGLE_AI_API_KEY — a name nothing else used — so its model list came
 * back empty on a deployment that had a perfectly good Gemini key under one of
 * the other names, and the UI then hid the model picker entirely. Resolve every
 * accepted name in one place.
 *
 * Deliberately free of SDK imports so cheap routes can read key *presence*
 * without pulling in the provider clients.
 */

/** Env var names accepted for each provider, in precedence order. */
export const PROVIDER_ENV_NAMES = {
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_API_KEY"],
  openai: ["OPENAI_API_KEY"],
} as const;

export type AIProvider = keyof typeof PROVIDER_ENV_NAMES;

/**
 * First non-empty value among the names accepted for `provider`.
 *
 * Reads process.env on every call rather than caching at module load, so the
 * value is never captured before the runtime has populated the environment.
 */
export function providerApiKey(provider: AIProvider): string | undefined {
  for (const name of PROVIDER_ENV_NAMES[provider]) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export const anthropicApiKey = () => providerApiKey("anthropic");
export const geminiApiKey = () => providerApiKey("google");

/** Whether a provider has a usable key. Never returns the key itself. */
export function hasProviderKey(provider: AIProvider): boolean {
  return !!providerApiKey(provider);
}

/**
 * Presence-only snapshot, safe to return to an authenticated operator.
 * Booleans only — never key material.
 */
export function providerKeyStatus(): Record<AIProvider, boolean> {
  return {
    anthropic: hasProviderKey("anthropic"),
    google: hasProviderKey("google"),
    openai: hasProviderKey("openai"),
  };
}

/**
 * Back-compat binding for the existing `import { GEMINI_API_KEY } from "@/lib/llm"`
 * call sites. Prefer `geminiApiKey()` in new code.
 */
export const GEMINI_API_KEY = providerApiKey("google");
