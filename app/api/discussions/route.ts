import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";

const PLAIN = { ALLOWED_TAGS: [] as string[], ALLOWED_ATTR: [] as string[] };
const RICH = { ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"], ALLOWED_ATTR: [] as string[] };

const schema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { courseId, lessonId, title, body } = parsed.data;
  const cleanTitle = DOMPurify.sanitize(title.trim(), PLAIN);
  const cleanBody = DOMPurify.sanitize(body.trim(), RICH);
  if (!cleanTitle || !cleanBody) return new Response("Missing fields", { status: 400 });

  const admin = createAdminClient();

  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", courseId).single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (!enrollment && profile.role !== "admin")
    return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin.from("discussions").insert({
    course_id: courseId,
    lesson_id: lessonId ?? null,
    user_id: user.id,
    title: cleanTitle,
    body: cleanBody,
  }).select().single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
