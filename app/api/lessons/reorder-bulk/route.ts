import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager", "space_manager"];

// Accepts the full ordered list of lesson ids for a course and rewrites each
// lesson's `order` to its position in that list. Unlike /api/lessons/reorder
// (which swaps two adjacent rows for the ▲▼ buttons), this handles a drag that
// moves a lesson across an arbitrary number of positions in one operation, and
// is idempotent: re-sending the same list is a no-op.
const schema = z.object({
  courseId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(1000),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { courseId, orderedIds } = parsed.data;

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  // Load the course's actual lessons so a caller can't reorder (or smuggle in)
  // lessons from another course. The submitted list must be exactly this set.
  const { data: existing } = await admin
    .from("lessons")
    .select("id")
    .eq("course_id", courseId);

  if (!existing) return new Response("Not found", { status: 404 });

  const existingIds = new Set(existing.map((l) => l.id));
  const submittedIds = new Set(orderedIds);
  const sameSize = existingIds.size === submittedIds.size;
  const sameMembers = sameSize && orderedIds.every((id) => existingIds.has(id));
  if (!sameMembers) {
    return new Response("Lesson list does not match this course", { status: 409 });
  }

  // Write sequential order values (1-based, matching how new lessons are numbered).
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      admin.from("lessons").update({ order: i + 1 }).eq("id", id).eq("course_id", courseId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return new Response(`Failed to reorder: ${failed.error.message}`, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
