import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { body } = await req.json();
  if (!body?.trim()) return new Response("Missing body", { status: 400 });

  const admin = createAdminClient();

  // Verify the discussion exists and user is enrolled
  const { data: discussion } = await admin
    .from("discussions")
    .select("course_id, user_id")
    .eq("id", params.id)
    .single();

  if (!discussion) return new Response("Not found", { status: 404 });

  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", discussion.course_id).single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!enrollment && profile?.role !== "admin")
    return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin.from("discussion_replies").insert({
    discussion_id: params.id,
    user_id: user.id,
    body: body.trim(),
  }).select().single();

  if (error) return new Response(error.message, { status: 500 });

  // Notify the discussion author if someone else replied
  if (discussion.user_id !== user.id) {
    await createNotification({
      user_id: discussion.user_id,
      type: "reply",
      title: "New reply to your discussion",
      body: `Someone replied to your discussion.`,
      link: `/learn/courses/${discussion.course_id}/discussions/${params.id}`,
    });
  }

  return Response.json(data);
}
