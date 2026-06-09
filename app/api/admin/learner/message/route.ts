import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendDirectMessageEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  userId: z.string().uuid(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(3000),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!senderProfile) return new Response("Unauthorized", { status: 401 });
  const ALLOWED_ROLES = ["admin", "course_creator", "course_manager"];
  if (!ALLOWED_ROLES.includes(senderProfile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { userId, subject, message } = parsed.data;

  // course_manager: can only message learners in their assigned cohort
  if (senderProfile.role === "course_manager") {
    const { data: cohort } = await admin
      .from("moderator_cohort_assignments")
      .select("learner_id")
      .eq("moderator_id", user.id)
      .eq("learner_id", userId)
      .maybeSingle();
    if (!cohort) return new Response("Forbidden — learner not in your cohort", { status: 403 });
  }

  // Load learner profile
  const { data: learner } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  if (!learner) return new Response("Learner not found", { status: 404 });

  const fromName = senderProfile.full_name || senderProfile.email || "Your facilitator";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dasavandir.org";

  // Create in-app notification
  await createNotification({
    user_id: userId,
    type: "direct_message",
    title: `💬 ${subject}`,
    body: message.length > 200 ? message.slice(0, 200) + "…" : message,
    link: "/learn/notifications",
  });

  // Send email (fire-and-forget — don't block the response)
  if (learner.email) {
    sendDirectMessageEmail({
      to: learner.email,
      learnerName: learner.full_name?.split(" ")[0] || learner.full_name || "",
      fromName,
      subject,
      message,
      notificationsUrl: `${baseUrl}/learn/notifications`,
    }).catch((err) => console.error("[direct-message/email]", err));
  }

  return Response.json({ ok: true });
}
