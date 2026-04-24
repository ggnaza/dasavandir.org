import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { submission_id, action, final_score, instructor_note, final_feedback } = await req.json();
  if (!["approve", "return"].includes(action)) return new Response("Invalid action", { status: 400 });

  const status = action === "approve" ? "approved" : "returned";

  const { data: submission } = await admin
    .from("capstone_submissions")
    .update({ status, final_score, instructor_note, final_feedback, reviewed_at: new Date().toISOString() })
    .eq("id", submission_id)
    .select("user_id, capstone_id, capstones(title, course_id)")
    .single();

  if (submission) {
    const capstone = submission.capstones as any;
    await createNotification({
      user_id: submission.user_id,
      type: status,
      title: status === "approved" ? "Capstone approved" : "Capstone returned",
      body: `Your capstone "${capstone?.title}" has been ${status === "approved" ? "approved" : "returned with feedback"}.`,
      link: capstone?.course_id ? `/learn/courses/${capstone.course_id}/capstone` : "/learn",
    });
  }

  return Response.json({ ok: true });
}
