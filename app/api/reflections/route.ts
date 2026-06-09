import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const postSchema = z.object({
  courseId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
});

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) return new Response("Missing courseId", { status: 400 });

  const admin = createAdminClient();

  // Verify enrollment
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!enrollment) return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin
    .from("reflections")
    .select("id, content, created_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) return new Response("Failed to fetch", { status: 500 });
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, content } = parsed.data;

  const admin = createAdminClient();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!enrollment) return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin
    .from("reflections")
    .insert({ user_id: user.id, course_id: courseId, content })
    .select("id, content, created_at")
    .single();

  if (error) return new Response("Failed to save", { status: 500 });
  return Response.json(data, { status: 201 });
}
