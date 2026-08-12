import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

async function getGroup(admin: any, groupId: string) {
  const { data } = await admin
    .from("course_groups")
    .select("id, course_id, moderator_id, phase_id")
    .eq("id", groupId)
    .single();
  return data;
}

// POST /api/admin/groups/[groupId]/members — add a learner to the group
export async function POST(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const group = await getGroup(admin, params.groupId);
  if (!group) return new Response("Group not found", { status: 404 });

  const ownerErr = await assertCourseOwner(group.course_id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = z.object({ userId: z.string().uuid() }).safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { userId } = parsed.data;

  // Must be enrolled in the course
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("course_id", group.course_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!enrollment) return new Response("Learner is not enrolled in this course", { status: 400 });

  // Enforce one group per learner per (course, phase). A phased course (e.g. TLA ->
  // Regional Orientation) lets a learner belong to one group in each phase; a course
  // with no phases keeps the old one-group-per-course behaviour (phase_id NULL is its
  // own bucket, so NULL vs NULL still collides). See ADR-0003.
  const { data: existingMemberships } = await admin
    .from("course_group_members")
    .select("group_id, course_groups!inner(course_id, phase_id)")
    .eq("user_id", userId);

  const targetPhase = (group.phase_id as string | null) ?? null;
  const alreadyInPhase = (existingMemberships ?? []).some((m) => {
    const cg = m.course_groups as any;
    return cg?.course_id === group.course_id && ((cg?.phase_id as string | null) ?? null) === targetPhase;
  });
  if (alreadyInPhase) {
    return new Response("This learner is already in a group for this phase", { status: 400 });
  }

  const { error } = await admin
    .from("course_group_members")
    .insert({ group_id: params.groupId, user_id: userId });

  if (error) {
    if (error.code === "23505") return new Response("Already a member", { status: 400 });
    return new Response(error.message, { status: 500 });
  }
  return new Response("OK");
}

// DELETE /api/admin/groups/[groupId]/members?userId=...
export async function DELETE(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const group = await getGroup(admin, params.groupId);
  if (!group) return new Response("Group not found", { status: 404 });

  const ownerErr = await assertCourseOwner(group.course_id, user.id);
  if (ownerErr) return ownerErr;

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return new Response("Missing userId", { status: 400 });

  await admin.from("course_group_members").delete().eq("group_id", params.groupId).eq("user_id", userId);
  return new Response("OK");
}
