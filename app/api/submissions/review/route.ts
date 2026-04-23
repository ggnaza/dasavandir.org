import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { submission_id, action, final_score, instructor_note, final_feedback } = await req.json();

  const status = action === "approve" ? "approved" : "returned";

  const { error } = await admin
    .from("submissions")
    .update({
      status,
      final_score: final_score ?? null,
      instructor_note: instructor_note ?? null,
      final_feedback: final_feedback ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission_id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
