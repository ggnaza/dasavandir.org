/**
 * Efficacy's AI calls.
 *
 * This file used to read `process.env.GOOGLE_GEMINI_API_KEY` directly and pin
 * `gemini-2.0-flash`. That meant a deployment holding a perfectly good Google
 * key under `GOOGLE_API_KEY` (or an Anthropic key and no Google key at all)
 * failed here while the LMS and Gnahatum worked — the same "AI is configured
 * but this module says it isn't" symptom Gnahatum had.
 *
 * Everything now goes through the shared resolvers: `lib/ai-keys.ts` for keys
 * (every accepted env-var name, in precedence order) and `lib/llm.ts` for the
 * admin-selected model. One key, one model setting, all three modules.
 */

import { GoogleGenAI } from "@google/genai";
import { geminiApiKey, hasProviderKey } from "@/lib/ai-keys";
import { callLLM, getAIModel } from "@/lib/llm";

/** Model used when the admin has picked none, or picked one we have no key for. */
const FALLBACK_MODEL = "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const key = geminiApiKey();
  if (!key) return null;
  if (!_client) _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

/**
 * The model to answer with: the platform-wide setting when its provider key
 * exists, otherwise a Gemini fallback. Returning a model whose provider has no
 * key is how "Scoring failed" style errors reach the user instead of a clear
 * "no key configured".
 */
async function resolveModel(): Promise<string> {
  const configured = await getAIModel();
  if (configured.startsWith("gemini-") && hasProviderKey("google")) return configured;
  if (configured.startsWith("claude-") && hasProviderKey("anthropic")) return configured;
  if (configured.startsWith("gpt-") && hasProviderKey("openai")) return configured;
  return FALLBACK_MODEL;
}

export async function generateContent(
  systemInstruction: string,
  contents: { role: string; parts: { text: string }[] }[],
) {
  const model = await resolveModel();

  // `callLLM` speaks a flat system + user pair, so multi-turn Gemini histories
  // stay on the native client; single-turn requests can use any provider.
  if (!model.startsWith("gemini-")) {
    const flattened = contents
      .map((c) => `${c.role === "model" ? "Assistant" : "User"}: ${c.parts.map((p) => p.text).join("\n")}`)
      .join("\n\n");
    const text = (await callLLM(model, systemInstruction, flattened, { temperature: 0.6 })).trim();
    if (!text) throw new Error("AI returned empty response");
    return text;
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      "No Google AI key configured. Set GOOGLE_GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment.",
    );
  }
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.6,
      // Gemini 2.5 thinking tokens are drawn from the output budget and can
      // consume all of it, returning empty text. Flash lets us switch it off.
      ...(model.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  });
  const text = (response.text ?? "").trim();
  if (!text) throw new Error("AI returned empty response");
  return text;
}

export async function embedText(text: string): Promise<number[]> {
  const ai = getGeminiClient();
  if (!ai) return [];
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}
