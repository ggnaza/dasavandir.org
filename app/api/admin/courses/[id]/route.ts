import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { logAudit } from "@/lib/audit-log";

// DELETE /api/admin/courses/[id] — delete a course and all of its dependent data.
//
// Why this runs server-side with the service-role client instead of a direct
// browser Supabase delete: several core child tables (lessons, enrollments,
// capstones, discussions, …) were created manually and do not all have
// ON DELETE CASCADE, so a plain `courses` delete fails with a foreign-key
// violation, and the browser client swallowed the error (UI stuck on "Deleting…").
//
// Schema varies between environments (migrations are applied by hand), so some
// listed tables/columns may not exist in a given database. Every child delete is
// therefore tolerant of "column/table does not exist" and simply skips it —
// deleting `lessons` cascades its own children (progress, quizzes, quiz_responses,
// assignments, submissions, …), which is the same behaviour the single-lesson
// delete endpoint relies on.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const courseId = params.id;

  // Run a delete, tolerating "does not exist" errors (undefined column 42703 /
  // undefined table 42P01) so schema differences never block the deletion.
  async function del(table: string, column: string, value: string | string[]): Promise<string | null> {
    const base = admin.from(table).delete();
    const { error } = Array.isArray(value) ? await base.in(column, value) : await base.eq(column, value);
    if (!error) return null;
    if (error.code === "42703" || error.code === "42P01" || /does not exist/i.test(error.message)) {
      console.warn(`[courses/delete] skipped ${table}.${column}: ${error.message}`);
      return null;
    }
    return `${table}: ${error.message}`;
  }

  // Capture the course title now (for the audit log — the row is about to be gone).
  const { data: courseRow } = await admin.from("courses").select("title").eq("id", courseId).maybeSingle();
  const courseTitle = courseRow?.title ?? null;

  // Ids of children that themselves have children whose FK may not cascade.
  const [{ data: capstones }, { data: discussions }, { data: lessons }] = await Promise.all([
    admin.from("capstones").select("id").eq("course_id", courseId),
    admin.from("discussions").select("id").eq("course_id", courseId),
    admin.from("lessons").select("id").eq("course_id", courseId),
  ]);
  const capstoneIds = (capstones ?? []).map((c) => c.id);
  const discussionIds = (discussions ?? []).map((d) => d.id);
  const lessonIds = (lessons ?? []).map((l) => l.id);

  // Ordered child deletes: grandchildren → lesson-keyed rows → course-keyed rows → lessons.
  const ops: Array<() => Promise<string | null>> = [];
  if (capstoneIds.length) ops.push(() => del("capstone_submissions", "capstone_id", capstoneIds));
  if (discussionIds.length) ops.push(() => del("discussion_replies", "discussion_id", discussionIds));
  // `progress` is keyed by lesson_id (no course_id column); clear it explicitly.
  if (lessonIds.length) ops.push(() => del("progress", "lesson_id", lessonIds));

  // Course-keyed children. `lessons` is last so its cascade clears the remaining
  // lesson children (progress, quizzes, quiz_responses, assignments, submissions…).
  const courseChildTables = [
    "capstones",
    "discussions",
    "enrollments",
    "question_bank",
    "announcements",
    "certificates",
    "invitations",
    "ai_coach_messages",
    "ai_coach_sessions",
    "ai_coach_memory",
    "course_creator_access",
    "course_manager_access",
    "lessons",
  ];
  for (const table of courseChildTables) ops.push(() => del(table, "course_id", courseId));

  for (const op of ops) {
    const err = await op();
    if (err) {
      console.error(`[courses/delete] ${err}`);
      return new Response(`Failed to delete course (${err})`, { status: 500 });
    }
  }

  const { error } = await admin.from("courses").delete().eq("id", courseId);
  if (error) {
    console.error("[courses/delete] failed deleting course", error);
    return new Response(`Failed to delete course: ${error.message}`, { status: 500 });
  }

  await logAudit("delete_course", user.id, _req, { course_id: courseId, course_title: courseTitle });
  return Response.json({ ok: true });
}

// PATCH /api/admin/courses/[id] — update a course's settings.
//
// Why this runs server-side with the service-role client instead of a direct
// browser Supabase update: the course UPDATE happens under RLS, and every
// role-resolving policy on `courses` evaluates `select … from profiles`, which
// re-enters the self-referential "Admins can view all profiles" policy on
// `profiles` and fails with 42P17 "infinite recursion detected in policy for
// relation profiles" (see OQ-003). That surfaced to course staff as
// "Could not save changes: infinite recursion detected in policy for relation
// profiles" when publishing. Per ADR-0003, real authorization lives in the API
// route (assertCourseOwner + service-role client), so the update runs here and
// bypasses the broken RLS entirely.

// Columns the editor is allowed to write. Anything else in the body is ignored,
// so this endpoint can't be used to set arbitrary/privileged columns.
const UPDATABLE_COLUMNS = [
  "title",
  "description",
  "published",
  "cover_image_url",
  "course_type",
  "access_type",
  "is_paid",
  "price_amd",
  "language",
  "category",
  "hours_to_complete",
  "outcomes",
  "pre_submission_ai",
  "ai_coach_enabled",
  "show_cohort_comparison",
  "allow_shuffled_learning",
  "deadline_days",
  "deadline_date",
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Only forward whitelisted columns that were actually sent, so a partial save
  // never clobbers unrelated columns with undefined.
  const update: Record<string, unknown> = {};
  for (const col of UPDATABLE_COLUMNS) {
    if (col in body) update[col] = body[col];
  }
  if (Object.keys(update).length === 0) {
    return new Response("No updatable fields in request", { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("courses").update(update).eq("id", params.id);
  if (error) {
    console.error("[courses/update] failed", error);
    return new Response(`Failed to update course: ${error.message}`, { status: 500 });
  }

  await logAudit("update_course", user.id, req, {
    course_id: params.id,
    fields: Object.keys(update),
  });
  return Response.json({ ok: true });
}
