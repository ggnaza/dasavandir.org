import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function isAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin";
}

// GET /api/admin/course-access?creator_id=xxx
export async function GET(req: Request) {
  if (!await isAdmin()) return new Response("Forbidden", { status: 403 });
  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");
  const admin = createAdminClient();
  const query = admin.from("course_creator_access").select("*, courses(id, title)");
  if (creator_id) query.eq("creator_id", creator_id);
  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}

// POST — assign a course to a creator
export async function POST(req: Request) {
  if (!await isAdmin()) return new Response("Forbidden", { status: 403 });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { creator_id, course_id } = await req.json();
  if (!creator_id || !course_id) return new Response("Missing fields", { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("course_creator_access").insert({ creator_id, course_id, granted_by: user!.id });
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}

// DELETE — remove a course from a creator
export async function DELETE(req: Request) {
  if (!await isAdmin()) return new Response("Forbidden", { status: 403 });
  const { creator_id, course_id } = await req.json();
  if (!creator_id || !course_id) return new Response("Missing fields", { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("course_creator_access").delete().eq("creator_id", creator_id).eq("course_id", course_id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
