import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

async function getGroupWithCourse(admin: any, groupId: string) {
  const { data } = await admin
    .from("course_groups")
    .select("id, course_id, moderator_id")
    .eq("id", groupId)
    .single();
  return data;
}

// PATCH /api/admin/groups/[groupId] — rename
export async function PATCH(req: Request, { params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const group = await getGroupWithCourse(admin, params.groupId);
  if (!group) return new Response("Not found", { status: 404 });

  const ownerErr = await assertCourseOwner(group.course_id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { error } = await admin.from("course_groups").update({ name: parsed.data.name }).eq("id", params.groupId);
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
