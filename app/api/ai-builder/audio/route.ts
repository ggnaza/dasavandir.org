import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import OpenAI from "openai";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// Parse slides_text (format: "[Slide 1]\n...\n\n[Slide 2]\n...") into per-slide strings
function parseSlidesText(slidesText: string): string[] {
  const parts = slidesText.split(/\[Slide \d+\]/);
  return parts
    .slice(1) // first element before any [Slide N] is empty
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function generateTts(openai: OpenAI, text: string): Promise<Buffer> {
  const speech = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text.slice(0, 4096),
  });
  return Buffer.from(await speech.arrayBuffer());
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

  const body = await req.json();
  const { lessonId, slides } = body;
  if (!lessonId || !UUID_RE.test(lessonId)) return new Response("Missing lessonId", { status: 400 });

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title, content, slides_text")
    .eq("id", lessonId)
    .single();

  if (!lesson) return new Response("Lesson not found", { status: 404 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // --- Slide-by-slide mode ---
  if (slides) {
    const slidesText = (lesson.slides_text ?? "").trim();
    if (!slidesText) return new Response("No slides content found — save the lesson with a Google Slides URL first", { status: 400 });

    const slideTexts = parseSlidesText(slidesText);
    if (slideTexts.length === 0) return new Response("Could not parse slide content", { status: 400 });
    if (slideTexts.length > 40) return new Response("Too many slides (max 40)", { status: 400 });

    const slideAudioUrls: string[] = [];

    for (let i = 0; i < slideTexts.length; i++) {
      const text = slideTexts[i];
      if (!text) { slideAudioUrls.push(""); continue; }

      const buffer = await generateTts(openai, text);
      const path = `lesson-audio/${lessonId}/slide-${i + 1}.mp3`;

      const { error: uploadError } = await admin.storage
        .from("lesson-audio")
        .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadError) {
        console.error("Slide audio upload error:", uploadError);
        return new Response(`Failed to upload audio for slide ${i + 1}`, { status: 500 });
      }

      const { data: { publicUrl } } = admin.storage.from("lesson-audio").getPublicUrl(path);
      slideAudioUrls.push(publicUrl);
    }

    await admin.from("lessons").update({ slide_audio_urls: slideAudioUrls }).eq("id", lessonId);
    return Response.json({ slideAudioUrls });
  }

  // --- Full lesson audio mode ---
  const rawText = [lesson.title, htmlToText(lesson.content ?? "")].join(". ").trim();
  if (!rawText) return new Response("Lesson has no content to narrate", { status: 400 });

  const buffer = await generateTts(openai, rawText);

  const path = `lesson-audio/${lessonId}.mp3`;
  const { error: uploadError } = await admin.storage
    .from("lesson-audio")
    .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return new Response("Failed to store audio", { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("lesson-audio").getPublicUrl(path);
  await admin.from("lessons").update({ audio_url: publicUrl }).eq("id", lessonId);

  return Response.json({ audioUrl: publicUrl });
}
