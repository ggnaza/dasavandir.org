import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
export { AI_MODELS, VALID_MODEL_IDS } from "@/lib/ai-models";
export type { AIModelId } from "@/lib/ai-models";

// Reads the global AI model from the settings table
export async function getAIModel(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("settings").select("value").eq("key", "ai_model").maybeSingle();
    if (data?.value) return data.value;
    // Backwards-compat: fall back to old key name
    const { data: old } = await admin.from("settings").select("value").eq("key", "ai_coach_model").maybeSingle();
    return old?.value ?? "gpt-4o-mini";
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
    const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
    const result = await gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: effectiveSystem, maxOutputTokens: maxTokens, temperature },
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
