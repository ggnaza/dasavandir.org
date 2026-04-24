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
  if (!["approve", "return"].includes(action)) return new Response("Invalid action", { status: 400 });

  await admin.from("capstone_submissions").update({
    status: action === "approve" ? "approved" : "returned",
    final_score,
    instructor_note,
    final_feedback,
    reviewed_at: new Date().toISOString(),
  }).eq("id", submission_id);

  return Response.json({ ok: true });
}
