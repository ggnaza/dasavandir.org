import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!data) return new Response("Not found", { status: 404 });

  return Response.json(data);
}
