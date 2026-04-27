import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator"].includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const isAdmin = profile?.role === "admin";

  // Get learner profiles with enrollments + progress
  let query = admin
    .from("profiles")
    .select(`id, full_name, created_at, enrollments(course_id, courses(id, title)), progress(id)`)
    .eq("role", "learner")
    .order("created_at", { ascending: false });

  const { data: learners } = await query;

  // Get emails + last login from auth.users
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authMap: Record<string, { email: string; last_login: string | null }> = {};
  for (const u of authUsers?.users ?? []) {
    authMap[u.id] = { email: u.email ?? "", last_login: u.last_sign_in_at ?? null };
  }

  // If course creator, only show learners enrolled in their courses
  let allowedCourseIds: Set<string> | null = null;
  if (!isAdmin) {
    const { data: access } = await admin
      .from("course_creator_access")
      .select("course_id")
      .eq("creator_id", user.id);
    allowedCourseIds = new Set((access ?? []).map((a: any) => a.course_id));
  }

  const result = (learners ?? [])
    .map((l: any) => {
      const courses = (l.enrollments ?? [])
        .filter((e: any) => !allowedCourseIds || allowedCourseIds.has(e.course_id))
        .map((e: any) => ({ id: e.course_id, title: e.courses?.title ?? "Unknown" }));

      return {
        id: l.id,
        full_name: l.full_name,
        email: authMap[l.id]?.email ?? "",
        last_login: authMap[l.id]?.last_login ?? null,
        joined: l.created_at,
        courses,
        lessons_completed: (l.progress ?? []).length,
      };
    })
    .filter((l: any) => !allowedCourseIds || l.courses.length > 0);

  return Response.json({ learners: result });
}
