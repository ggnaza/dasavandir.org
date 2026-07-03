import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { getCourseReviewers } from "@/lib/course-reviewers";

// GET /api/admin/courses/[id]/reviewers — moderators + creators who can be
// assigned to review this course's submissions (for the reassign picker).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const reviewers = await getCourseReviewers(admin, params.id);
  return Response.json({ reviewers });
}
