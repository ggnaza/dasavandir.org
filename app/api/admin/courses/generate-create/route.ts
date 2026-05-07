import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const lessonSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(50000).default(""),
  what_you_learn: z.string().max(1000).default(""),
  slides_outline: z.string().max(5000).default(""),
  video_script: z.string().max(5000).default(""),
});

const schema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  outcomes: z.array(z.string().max(300)).max(10).default([]),
  language: z.enum(["en", "hy"]).default("en"),
  materialUrl: z.string().url().optional().nullable(),
  lessons: z.array(lessonSchema).min(1).max(20),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { title, description, outcomes, language, materialUrl, lessons } = parsed.data;

  // Create the course
  const { data: course, error: courseError } = await admin
    .from("courses")
    .insert({
      title,
      description: description || null,
      outcomes: outcomes.filter(Boolean),
      language,
      published: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (courseError || !course) {
    return new Response("Failed to create course", { status: 500 });
  }

  // Create all lessons in order
  const lessonRows = lessons.map((lesson, i) => ({
    course_id: course.id,
    title: lesson.title,
    content: lesson.content || null,
    what_you_learn: lesson.what_you_learn || null,
    order: i + 1,
  }));

  const { error: lessonsError } = await admin.from("lessons").insert(lessonRows);
  if (lessonsError) {
    await admin.from("courses").delete().eq("id", course.id);
    return new Response("Failed to create lessons", { status: 500 });
  }

  // If a material URL was provided, add it as a course resource so the AI coach can use it
  if (materialUrl) {
    let extractedText = "";
    try {
      const GOOGLE_DOCS_RE = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
      const GOOGLE_SLIDES_RE = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;
      const docsMatch = materialUrl.match(GOOGLE_DOCS_RE);
      const slidesMatch = materialUrl.match(GOOGLE_SLIDES_RE);
      if (docsMatch) {
        const res = await fetch(`https://docs.google.com/document/d/${docsMatch[1]}/export?format=txt`, { cache: "no-store" });
        if (res.ok) extractedText = (await res.text()).trim().slice(0, 20000);
      } else if (slidesMatch) {
        const res = await fetch(`https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`, { cache: "no-store" });
        if (res.ok) extractedText = (await res.text()).trim().slice(0, 20000);
      }
    } catch {}

    await admin.from("course_resources").insert({
      course_id: course.id,
      title: "Source material",
      url: materialUrl,
      extracted_text: extractedText || null,
    });
  }

  return Response.json({ courseId: course.id });
}
