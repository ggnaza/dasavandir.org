import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { lessonId, chapters } = await req.json();
  if (!lessonId) return new Response("Missing lessonId", { status: 400 });

  const { error } = await admin.from("lessons").update({ chapters }).eq("id", lessonId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response("ok");
}
