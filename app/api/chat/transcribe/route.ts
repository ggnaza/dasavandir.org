import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File;
    if (!audio) return new Response("No audio", { status: 400 });

    // Limit to 10MB
    if (audio.size > 10 * 1024 * 1024) return new Response("File too large", { status: 413 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      // Don't force language — let Whisper auto-detect Armenian, English, etc.
    });

    return Response.json({ text: transcription.text });
  } catch (e: any) {
    return new Response(e.message ?? "Transcription failed", { status: 500 });
  }
}
