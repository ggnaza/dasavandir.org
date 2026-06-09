import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

// GET /api/admin/courses/[id]/groups
// Returns all groups (+ members) for this course, filtered by moderator ownership for managers
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();

  let query = admin
    .from("course_groups")
    .select("id, name, moderator_id, created_at, course_group_members(user_id, profiles(full_name, email))")
    .eq("course_id", params.id)
    .order("created_at");

  // Managers only see their own groups
  if (profile?.role === "course_manager") {
    query = query.eq("moderator_id", user.id);
  }

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/admin/courses/[id]/groups — create a new group
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const body = await req.json();
  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(body);
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_groups")
    .insert({ course_id: params.id, name: parsed.data.name, moderator_id: user.id })
    .select("id, name, moderator_id, created_at")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
