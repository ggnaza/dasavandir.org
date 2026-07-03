import { createAdminClient } from "@/lib/supabase/admin";
import { buildReviewerMap } from "@/lib/reviewer-map";
import { sendReviewReminderEmail } from "@/lib/email";

// Vercel Cron calls this daily with Authorization: Bearer <CRON_SECRET>.
// Emails each moderator a reminder of how many submissions still await their review.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Pending = awaiting a moderator's verdict (not needs_revision, which waits on the learner).
  const { data: pending } = await admin
    .from("submissions")
    .select("id, user_id, assignment_id, assignments(lessons(course_id))")
    .in("status", ["submitted", "ai_reviewed"]);

  if (!pending?.length) return Response.json({ moderatorsNotified: 0 });

  const courseIds = Array.from(
    new Set(pending.map((s) => (s.assignments as any)?.lessons?.course_id).filter(Boolean))
  ) as string[];
  const reviewerMap = await buildReviewerMap(admin, courseIds);

  const countByMod = new Map<string, number>();
  for (const s of pending) {
    const cid = (s.assignments as any)?.lessons?.course_id;
    if (!cid) continue;
    const modId = reviewerMap.get(`${s.user_id}:${cid}`);
    if (!modId) continue;
    countByMod.set(modId, (countByMod.get(modId) ?? 0) + 1);
  }
  if (countByMod.size === 0) return Response.json({ moderatorsNotified: 0 });

  const modIds = Array.from(countByMod.keys());
  const { data: mods } = await admin.from("profiles").select("id, full_name, email").in("id", modIds);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dasavandir.org";

  let notified = 0;
  for (const m of mods ?? []) {
    const count = countByMod.get(m.id) ?? 0;
    if (!m.email || count === 0) continue;
    try {
      await sendReviewReminderEmail({
        to: m.email,
        reviewerName: m.full_name?.split(" ")[0] ?? "",
        pendingCount: count,
        reviewUrl: `${siteUrl}/admin/submissions`,
      });
      notified++;
    } catch (e) {
      console.error("[cron/review-reminders]", m.id, e);
    }
  }

  return Response.json({ moderatorsNotified: notified, pending: pending.length });
}
