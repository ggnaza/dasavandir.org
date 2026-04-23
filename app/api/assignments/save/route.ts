import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { id, lesson_id, title, instructions, rubric } = await req.json();

  if (id) {
    const { error } = await admin
      .from("assignments")
      .update({ title, instructions, rubric })
      .eq("id", id);
    if (error) return new Response(error.message, { status: 500 });
  } else {
    const { error } = await admin
      .from("assignments")
      .insert({ lesson_id, title, instructions, rubric });
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response("OK");
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { id } = await req.json();
  await admin.from("assignments").delete().eq("id", id);
  return new Response("OK");
}
