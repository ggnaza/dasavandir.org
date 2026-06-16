import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
export { AI_MODELS, VALID_MODEL_IDS } from "@/lib/ai-models";
export type { AIModelId } from "@/lib/ai-models";

// Google Gemini API key — supports both naming conventions
export const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

// Retired model IDs → current replacements
const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash-preview-04-17": "gemini-2.5-flash",
  "gemini-2.5-pro-preview-05-06":   "gemini-2.5-pro",
  "gemini-2.5-pro-preview-06-05":   "gemini-2.5-pro",
};

// Reads the global AI model from the settings table
export async function getAIModel(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("settings").select("value").eq("key", "ai_model").maybeSingle();
    if (data?.value) return DEPRECATED_MODELS[data.value] ?? data.value;
    // Backwards-compat: fall back to old key name
    const { data: old } = await admin.from("settings").select("value").eq("key", "ai_coach_model").maybeSingle();
    const v = old?.value ?? "gpt-4o-mini";
    return DEPRECATED_MODELS[v] ?? v;
  } catch {
    return "gpt-4o-mini";
  }
}

// Single non-streaming LLM call — returns the text response
export async function callLLM(
  model: string,
  systemPrompt: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const { maxTokens = 2000, temperature = 0.7, jsonMode = false } = opts;

  // For non-OpenAI models, append a JSON-only instruction when jsonMode is requested
  const effectiveSystem =
    jsonMode && !model.startsWith("gpt-")
      ? `${systemPrompt}\n\nReturn ONLY valid JSON — no markdown fences, no explanation.`
      : systemPrompt;

  if (model.startsWith("claude-")) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: effectiveSystem,
      messages: [{ role: "user", content: userMessage }],
    });
    return (msg.content[0] as Anthropic.TextBlock).text ?? "";
  }

  if (model.startsWith("gemini-")) {
    const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: effectiveSystem,
        maxOutputTokens: maxTokens,
        temperature,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        // Gemini 2.5 thinking tokens count against maxOutputTokens and can
        // consume the entire budget, returning empty text. Flash models allow
        // disabling thinking; Pro does not (minimum budget is enforced).
        ...(model.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });
    return result.text ?? "";
  }

  // OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 });
  const completion = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: "system", content: effectiveSystem },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  return completion.choices[0].message.content ?? "";
}
