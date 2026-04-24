import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { id, course_id, title, instructions, rubric } = await req.json();
  if (!course_id || !title?.trim()) return new Response("Missing fields", { status: 400 });

  const { data, error } = id
    ? await admin.from("capstones").update({ title, instructions, rubric }).eq("id", id).select().single()
    : await admin.from("capstones").upsert({ course_id, title, instructions, rubric }, { onConflict: "course_id" }).select().single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { id } = await req.json();
  await admin.from("capstones").delete().eq("id", id);
  return Response.json({ deleted: true });
}
