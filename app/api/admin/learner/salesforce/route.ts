import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffCanAccessLearner } from "@/lib/auth/learner-access";
import { z } from "zod";

const schema = z.object({
  userId: z.string().uuid(),
  salesforce_url: z.string().url().max(500).nullable().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator", "course_manager"].includes(profile?.role ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { userId, salesforce_url } = parsed.data;

  // Staff may only edit a learner they share a course/cohort with (admins: any;
  // managers: their cohort; creators: learners enrolled in one of their courses).
  const canAccess = await staffCanAccessLearner(admin, user.id, profile?.role ?? "", userId);
  if (!canAccess) return new Response("Forbidden — not your learner", { status: 403 });

  const { error } = await admin
    .from("profiles")
    .update({ salesforce_url: salesforce_url || null })
    .eq("id", userId);

  if (error) {
    console.error("[learner/salesforce]", error);
    return new Response("Failed to update", { status: 500 });
  }

  return Response.json({ ok: true });
}
