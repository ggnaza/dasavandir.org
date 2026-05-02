import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get("course_id");
  if (!course_id) return new Response("Missing course_id", { status: 400 });

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  const { data: accessRows, error } = await admin
    .from("course_manager_access")
    .select("manager_id, created_at")
    .eq("course_id", course_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[moderators/get]", error);
    return new Response("Failed to fetch moderators", { status: 500 });
  }
  if (!accessRows || accessRows.length === 0) return Response.json([]);

  const ids = accessRows.map((r) => r.manager_id);
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const userMap = new Map(authData?.users.map((u) => [u.id, u.email]) ?? []);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return Response.json(accessRows.map((row) => ({
    manager_id: row.manager_id,
    created_at: row.created_at,
    full_name: profileMap.get(row.manager_id) ?? null,
    email: userMap.get(row.manager_id) ?? null,
  })));
}

const addSchema = z.object({
  course_id: z.string().uuid(),
  email: z.string().email(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator"].includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { course_id, email } = parsed.data;

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  // Find the target user by email
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const targetAuthUser = authData?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (!targetAuthUser) return new Response("No account found with that email", { status: 404 });

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", targetAuthUser.id)
    .single();

  if (!targetProfile) return new Response("User profile not found", { status: 404 });

  // Upgrade to course_manager if they're currently a learner
  if (targetProfile.role === "learner") {
    await admin.from("profiles").update({ role: "course_manager" }).eq("id", targetProfile.id);
  }

  const { error } = await admin.from("course_manager_access").upsert(
    { manager_id: targetProfile.id, course_id, granted_by: user.id },
    { onConflict: "manager_id,course_id" }
  );
  if (error) {
    console.error("[moderators/add]", error);
    return new Response("Failed to add moderator", { status: 500 });
  }

  return Response.json({ ok: true });
}

const deleteSchema = z.object({
  manager_id: z.string().uuid(),
  course_id: z.string().uuid(),
});

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "course_creator"].includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { manager_id, course_id } = parsed.data;

  const ownerErr = await assertCourseOwner(course_id, user.id);
  if (ownerErr) return ownerErr;

  await admin.from("course_manager_access")
    .delete()
    .eq("manager_id", manager_id)
    .eq("course_id", course_id);

  return Response.json({ ok: true });
}
