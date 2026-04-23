import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { lesson_id, file_name, storage_path } = await req.json();

  const { data, error } = await admin
    .from("lesson_files")
    .insert({ lesson_id, file_name, storage_path })
    .select()
    .single();

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
  await admin.from("lesson_files").delete().eq("id", id);
  return new Response("OK");
}
