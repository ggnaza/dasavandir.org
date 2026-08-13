import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

// AI-coach instructions are a creator-level control: only admins and the course's
// own creators may read/write them. course_managers (moderators) are intentionally
// excluded — they run cohorts, they don't tune the course's AI behaviour.
const CREATOR_ROLES = ["admin", "course_creator"];

async function authorize(courseId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Response("Unauthorized", { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!CREATOR_ROLES.includes(profile?.role ?? "")) {
    return { error: new Response("Forbidden", { status: 403 }) };
  }

  // course_creators must have access to this specific course
  if (profile?.role === "course_creator") {
    const { data: access } = await admin
      .from("course_creator_access")
      .select("id")
      .eq("creator_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    if (!access) return { error: new Response("Forbidden", { status: 403 }) };
  }

  return { admin, user };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error, admin } = await authorize(params.id);
  if (error) return error;

  const { data } = await admin!
    .from("courses")
    .select("ai_coach_instructions")
    .eq("id", params.id)
    .single();

  return Response.json({ ai_coach_instructions: data?.ai_coach_instructions ?? "" });
}

const schema = z.object({
  ai_coach_instructions: z.string().max(3000),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error, admin } = await authorize(params.id);
  if (error) return error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  await admin!
    .from("courses")
    .update({ ai_coach_instructions: parsed.data.ai_coach_instructions || null })
    .eq("id", params.id);

  return Response.json({ ok: true });
}
