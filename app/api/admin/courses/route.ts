import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { data, error } = await supabase.from("courses").select("id, title").order("title");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ courses: data });
}
