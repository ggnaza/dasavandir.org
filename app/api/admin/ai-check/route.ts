import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAIModel, GEMINI_API_KEY } from "@/lib/llm";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const model = await getAIModel();
  const results: Record<string, any> = { configured_model: model };

  if (model.startsWith("gemini-")) {
    const key = GEMINI_API_KEY;
    results.key_present = !!key;
    results.key_prefix = key ? key.slice(0, 8) + "..." : null;
    if (!key) {
      results.error = "GOOGLE_GEMINI_API_KEY (or GOOGLE_API_KEY) is not set in environment";
    } else {
      try {
        const gemini = new GoogleGenAI({ apiKey: key });
        const res = await gemini.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        });
        results.test_response = res.text;
        results.status = "ok";
      } catch (err: any) {
        results.error = err?.message ?? String(err);
        results.status = "error";
      }
    }
  } else if (model.startsWith("claude-")) {
    const key = process.env.ANTHROPIC_API_KEY;
    results.key_present = !!key;
    if (!key) {
      results.error = "ANTHROPIC_API_KEY is not set";
    } else {
      try {
        const anthropic = new Anthropic({ apiKey: key });
        const msg = await anthropic.messages.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
        });
        results.test_response = (msg.content[0] as any).text;
        results.status = "ok";
      } catch (err: any) {
        results.error = err?.message ?? String(err);
        results.status = "error";
      }
    }
  } else {
    const key = process.env.OPENAI_API_KEY;
    results.key_present = !!key;
    if (!key) {
      results.error = "OPENAI_API_KEY is not set";
    } else {
      try {
        const openai = new OpenAI({ apiKey: key, timeout: 10_000 });
        const completion = await openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
          max_tokens: 10,
        });
        results.test_response = completion.choices[0].message.content;
        results.status = "ok";
      } catch (err: any) {
        results.error = err?.message ?? String(err);
        results.status = "error";
      }
    }
  }

  return Response.json(results);
}
