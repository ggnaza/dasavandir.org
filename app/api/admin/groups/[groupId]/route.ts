import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getCourseReviewers } from "@/lib/course-reviewers";
import { z } from "zod";

async function getGroupWithCourse(admin: any, groupId: string) {
  const { data } = await admin
    .from("course_groups")
    .select("id, course_id, moderator_id")
    .eq("id", groupId)
    .single();
  return data;
}

// PATCH /api/admin/groups/[groupId] — rename and/or set the group's moderator
export async function PATCH(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const group = await getGroupWithCourse(admin, params.groupId);
  if (!group) return new Response("Not found", { status: 404 });

  const ownerErr = await assertCourseOwner(group.course_id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = z.object({
    name: z.string().min(1).max(100).optional(),
    moderator_id: z.string().uuid().nullable().optional(),
  }).safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;

  if (parsed.data.moderator_id !== undefined) {
    // Setting the moderator is an admin/creator action, and the person must be a
    // moderator or creator of this course.
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!["admin", "course_creator"].includes(profile?.role ?? "")) {
      return new Response("Only admins and course creators can set a group's moderator.", { status: 403 });
    }
    if (parsed.data.moderator_id) {
      const reviewers = await getCourseReviewers(admin, group.course_id);
      if (!reviewers.some((r) => r.id === parsed.data.moderator_id)) {
        return new Response("That person can't moderate this course.", { status: 400 });
      }
    }
    update.moderator_id = parsed.data.moderator_id;
  }

  if (Object.keys(update).length === 0) return new Response("Nothing to update", { status: 400 });

  const { error } = await admin.from("course_groups").update(update).eq("id", params.groupId);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}

// DELETE /api/admin/groups/[groupId]
export async function DELETE(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const group = await getGroupWithCourse(admin, params.groupId);
  if (!group) return new Response("Not found", { status: 404 });

  const ownerErr = await assertCourseOwner(group.course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("course_groups").delete().eq("id", params.groupId);
  return new Response("OK");
}
