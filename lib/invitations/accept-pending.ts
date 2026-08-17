import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Convert a user's pending course invitations into enrollments.
 *
 * Why this exists (see CLAUDE.md — enrollment/invitation invariants):
 * The three server pages that auto-enroll on visit (/learn, the course page,
 * and the lesson page) used to run the enrollment upsert and the
 * `invitations.status = 'accepted'` update **concurrently** in a
 * `Promise.all`, without checking the enrollment result. When the enrollment
 * upsert failed (a transient error, or an FK violation before the profile
 * row existed) the invite was STILL flipped to `accepted`. Because the
 * auto-enroll query only ever looks at `status = 'pending'` invites, that
 * user was permanently stranded: no enrollment, no access, invisible in the
 * enrolled list, and never retried. Re-inviting did not help either — the
 * invite upsert uses `ignoreDuplicates` on `(course_id, email)`, so it
 * re-sends the email but leaves the row `accepted`.
 *
 * The fix: mark an invitation `accepted` ONLY after its enrollment upsert has
 * succeeded. If the enrollment write fails, the invite stays `pending` so the
 * next visit retries it. Idempotent — safe to call on every page load.
 *
 * Requires the admin (service role) client: enrollment/invitation writes must
 * bypass RLS.
 */
export async function acceptPendingInvitations(
  admin: SupabaseClient,
  userId: string,
  invites: { id: string; course_id: string }[]
): Promise<void> {
  for (const inv of invites) {
    const { error: enrollErr } = await admin
      .from("enrollments")
      .upsert(
        { user_id: userId, course_id: inv.course_id },
        { onConflict: "user_id,course_id" }
      );

    if (enrollErr) {
      // Do NOT mark the invite accepted — leave it pending so a later visit
      // retries. Flipping it here is exactly what stranded users in prod.
      console.error(
        "[acceptPendingInvitations] enrollment upsert failed; leaving invite pending",
        { userId, courseId: inv.course_id, error: enrollErr.message }
      );
      continue;
    }

    const { error: updateErr } = await admin
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id);

    if (updateErr) {
      // The enrollment exists, so the user has access; the invite just stays
      // pending and will be re-accepted (idempotently) on the next visit.
      console.error("[acceptPendingInvitations] invite status update failed", {
        inviteId: inv.id,
        error: updateErr.message,
      });
    }
  }
}
