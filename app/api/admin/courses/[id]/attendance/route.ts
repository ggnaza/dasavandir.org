import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

// GET /api/admin/courses/[id]/attendance?entry_id=<uuid>
// Returns enrolled learners (scoped to moderator's cohort if applicable) + any existing attendance rows.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const entryId = new URL(req.url).searchParams.get("entry_id");
  if (!entryId) return new Response("Missing entry_id", { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const isManager = profile?.role === "course_manager";

  // Get learner list — managers only see their assigned cohort
  let learnerIds: string[] | null = null;
  if (isManager) {
    const { data: cohort } = await admin
      .from("moderator_cohort_assignments")
      .select("learner_id")
      .eq("moderator_id", user.id)
      .eq("course_id", params.id);
    learnerIds = (cohort ?? []).map((c) => c.learner_id);
    if (learnerIds.length === 0) return Response.json({ learners: [], attendance: [] });
  }

  // Enrolled learners with profiles
  let enrollmentQuery = admin
    .from("enrollments")
    .select("user_id, profiles(full_name, email)")
    .eq("course_id", params.id);

  if (learnerIds) {
    enrollmentQuery = enrollmentQuery.in("user_id", learnerIds);
  }

  const { data: enrollments } = await enrollmentQuery;

  const learners = (enrollments ?? []).map((e) => {
    const p = e.profiles as any;
    return { user_id: e.user_id, name: p?.full_name || p?.email || "Unknown", email: p?.email || "" };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Existing attendance rows for this session
  const { data: attendanceRows } = await admin
    .from("attendance")
    .select("user_id, status, note")
    .eq("timetable_entry_id", entryId);

  return Response.json({ learners, attendance: attendanceRows ?? [] });
}

const upsertSchema = z.object({
  timetable_entry_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(["on_time", "late", "absent", "unmarked"]),
  note: z.string().max(500).nullable().optional(),
});

// POST /api/admin/courses/[id]/attendance — upsert a single attendance row
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { timetable_entry_id, user_id, status, note } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.from("attendance").upsert(
    {
      timetable_entry_id,
      course_id: params.id,
      user_id,
      status,
      note: note ?? null,
      recorded_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "timetable_entry_id,user_id" }
  );

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
