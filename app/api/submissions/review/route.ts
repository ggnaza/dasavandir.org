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

  const status = action === "approve" ? "approved" : "returned";

  const { data: submission, error } = await admin
    .from("submissions")
    .update({
      status,
      final_score: final_score ?? null,
      instructor_note: instructor_note ?? null,
      final_feedback: final_feedback ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submission_id)
    .select("user_id, assignment_id, assignments(title, lessons(course_id))")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  if (submission) {
    const assignment = submission.assignments as any;
    const courseId = assignment?.lessons?.course_id;
    await createNotification({
      user_id: submission.user_id,
      type: status,
      title: status === "approved" ? "Submission approved" : "Submission returned",
      body: `Your submission for "${assignment?.title}" has been ${status === "approved" ? "approved" : "returned with feedback"}.`,
      link: courseId ? `/learn/courses/${courseId}/lessons/${assignment?.lesson_id}/assignment` : "/learn",
    });
  }

  return new Response("OK");
}
