import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const schema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
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

  const { lessonId, courseId, direction } = parsed.data;

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return ownerErr;

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, order")
    .eq("course_id", courseId)
    .order("order");

  if (!lessons) return new Response("Not found", { status: 404 });

  const idx = lessons.findIndex((l) => l.id === lessonId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;

  if (swapIdx < 0 || swapIdx >= lessons.length) {
    return new Response("OK", { status: 200 });
  }

  const a = lessons[idx];
  const b = lessons[swapIdx];

  await Promise.all([
    admin.from("lessons").update({ order: b.order }).eq("id", a.id),
    admin.from("lessons").update({ order: a.order }).eq("id", b.id),
  ]);

  return new Response("OK", { status: 200 });
}
