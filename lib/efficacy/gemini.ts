import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export const MODEL = "gemini-2.0-flash";

export function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) return null;
  if (!_client) _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

export async function generateContent(systemInstruction: string, contents: { role: string; parts: { text: string }[] }[]) {
  const ai = getGeminiClient();
  if (!ai) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction, temperature: 0.6 },
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
