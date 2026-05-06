import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const rubricItemSchema = z.object({
  criterion: z.string().min(1).max(200),
  description: z.string().max(1000),
  max_points: z.number().int().min(0).max(1000),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  instructions: z.string().max(20_000),
  rubric: z.array(rubricItemSchema).min(1).max(20),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { id, course_id, title, instructions, rubric } = parsed.data;

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  const { data, error } = id
    ? await admin.from("capstones").update({ title, instructions, rubric }).eq("id", id).select().single()
    : await admin.from("capstones").upsert({ course_id, title, instructions, rubric }, { onConflict: "course_id" }).select().single();

  if (error) {
    console.error("[capstones/save]", error);
    return new Response("Failed to save capstone", { status: 500 });
  }

  return Response.json(data);
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  // Look up the capstone's course to verify ownership
  const { data: capstone } = await admin.from("capstones").select("course_id").eq("id", parsed.data.id).single();
  if (!capstone) return new Response("Capstone not found", { status: 404 });

  const ownerErr = await assertCourseOwner(capstone.course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("capstones").delete().eq("id", parsed.data.id);
  return Response.json({ deleted: true });
}
