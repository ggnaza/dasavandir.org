import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const createSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  video_url: z.string().url().max(2000).nullable().optional(),
});

// POST /api/admin/lessons — create a new lesson
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { course_id, title, content, video_url } = parsed.data;

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();

  // Get next order value
  const { data: last } = await admin
    .from("lessons")
    .select("order")
    .eq("course_id", course_id)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.order ?? 0) + 1;

  const { data, error } = await admin
    .from("lessons")
    .insert({ course_id, title, content: content ?? "", video_url: video_url ?? null, order: nextOrder })
    .select("id")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ id: data.id });
}
