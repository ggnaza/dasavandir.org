import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const accessErr = await assertCourseOwner(params.id, user.id);
  if (accessErr) return accessErr;

  const admin = createAdminClient();
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("user_id")
    .eq("course_id", params.id);

  const userIds = (enrollments ?? []).map((e) => e.user_id);
  if (userIds.length === 0) return Response.json([]);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  return Response.json(
    (profiles ?? []).map((p) => ({
      userId: p.id,
      name: p.full_name ?? p.email ?? p.id,
      email: p.email ?? "",
    }))
  );
}
