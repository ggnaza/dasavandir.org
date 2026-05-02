import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import OpenAI from "openai";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strip HTML tags and decode basic entities
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { allowed } = await checkRateLimit(`audio-gen:${user.id}`, 10, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 10, windowSecs: 3600 });

  const { lessonId } = await req.json();
  if (!lessonId || !UUID_RE.test(lessonId)) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title, content")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const rawText = [lesson.title, htmlToText(lesson.content ?? "")].join(". ").trim();
  if (!rawText) return new Response("Lesson has no content to narrate", { status: 400 });

  // OpenAI TTS supports max 4096 chars — truncate if needed
  const input = rawText.slice(0, 4096);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const speech = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input,
  });

  const buffer = Buffer.from(await speech.arrayBuffer());

  // Upload to Supabase Storage
  const path = `lesson-audio/${lessonId}.mp3`;
  const { error: uploadError } = await admin.storage
    .from("lesson-audio")
    .upload(path, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return new Response("Failed to store audio", { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from("lesson-audio")
    .getPublicUrl(path);

  await admin.from("lessons").update({ audio_url: publicUrl }).eq("id", lessonId);

  return Response.json({ audioUrl: publicUrl });
}
