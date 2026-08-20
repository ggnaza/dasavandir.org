import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrgId, getManagedSpaceIds } from "@/lib/org";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const allowed = ["admin", "course_creator", "space_manager"];
  if (!allowed.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const { title, description } = await req.json();
  if (!title?.trim()) return new Response("Title is required", { status: 400 });

  const orgId = await getCurrentOrgId(admin);
  // A space manager's new course lands in one of their spaces so it's visible to them immediately.
  let spaceId: string | null = null;
  if (profile?.role === "space_manager") {
    const managed = await getManagedSpaceIds(admin, user.id);
    if (managed.length === 0) return new Response("You do not manage any space yet.", { status: 403 });
    spaceId = managed[0] ?? null;
  }

  const { data: course, error } = await admin
    .from("courses")
    .insert({ title: title.trim(), description: description?.trim() || null, created_by: user.id, org_id: orgId, space_id: spaceId })
    .select("id")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  // Course creators must be explicitly linked to see/edit the course
  if (profile?.role === "course_creator") {
    await admin.from("course_creator_access").insert({
      creator_id: user.id,
      course_id: course.id,
      granted_by: user.id,
    });
  }

  return Response.json({ id: course.id });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { data, error } = await admin.from("courses").select("id, title").order("title");
  if (error) {
    console.error("[admin/courses]", error);
    return new Response("Failed to fetch courses", { status: 500 });
  }
  return Response.json({ courses: data });
}
