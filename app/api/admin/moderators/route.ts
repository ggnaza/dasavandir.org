import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get("course_id");
  if (!course_id) return new Response("Missing course_id", { status: 400 });

  const admin = createAdminClient();

  // Step 1: get access rows
  const { data: accessRows, error } = await admin
    .from("course_manager_access")
    .select("manager_id, created_at")
    .eq("course_id", course_id)
    .order("created_at", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });
  if (!accessRows || accessRows.length === 0) return Response.json([]);

  // Step 2: get profiles for those manager_ids
  const ids = accessRows.map((r) => r.manager_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  // Step 3: get emails from auth
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userMap = new Map(authData?.users.map((u) => [u.id, u.email]) ?? []);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const result = accessRows.map((row) => ({
    manager_id: row.manager_id,
    created_at: row.created_at,
    full_name: profileMap.get(row.manager_id) ?? null,
    email: userMap.get(row.manager_id) ?? null,
  }));

  return Response.json(result);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { action, course_id, email } = await req.json();
  const admin = createAdminClient();

  if (action === "add") {
    // Find user by email
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", (
        await admin.auth.admin.listUsers()
      ).data.users.find((u) => u.email?.toLowerCase() === email?.toLowerCase())?.id ?? "")
      .single();

    if (!targetProfile) return new Response("User not found with that email", { status: 404 });

    // Upgrade role to course_manager if they're a learner
    if (targetProfile.role === "learner") {
      await admin.from("profiles").update({ role: "course_manager" }).eq("id", targetProfile.id);
    }

    const { error } = await admin.from("course_manager_access").upsert(
      { manager_id: targetProfile.id, course_id, granted_by: user.id },
      { onConflict: "manager_id,course_id" }
    );
    if (error) return new Response(error.message, { status: 500 });
    return Response.json({ ok: true });
  }

  if (action === "remove") {
    const { manager_id } = await req.json().catch(() => ({})) as any;
    // manager_id is already parsed above via email; re-parse body separately
    // Accept manager_id directly in this action
    const body = await req.json().catch(() => null);
    return new Response("Use DELETE /api/admin/moderators?manager_id=X&course_id=Y", { status: 400 });
  }

  return new Response("Invalid action", { status: 400 });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { manager_id, course_id } = await req.json();
  const admin = createAdminClient();

  await admin.from("course_manager_access").delete()
    .eq("manager_id", manager_id)
    .eq("course_id", course_id);

  return Response.json({ ok: true });
}
