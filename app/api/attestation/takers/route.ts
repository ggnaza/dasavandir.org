import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { profilesByEmail } from "@/lib/attestation/people";
import { parseEmails } from "@/lib/attestation-core";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmailBatch } from "@/lib/email";
import { attestationInviteEmail, inviteLinkOrigin } from "@/lib/attestation-invite-email";
import { ATTESTATION_LANDING, createInvitedAccount, freshSetPasswordLink, inviteStanding } from "@/lib/attestation/invite-accounts";

export const dynamic = "force-dynamic";
// Creating accounts and links is one Supabase call per new teacher.
export const maxDuration = 60;

/** New accounts one request may create (≈7 Supabase calls each); the rest are reported back. */
const MAX_NEW_ACCOUNTS = 50;
/** New accounts one manager may create per day (spam / sender-reputation ceiling). */
const DAILY_NEW_ACCOUNTS = 300;

/**
 * Teachers invited to take tests (ADR-0011). A teacher has a `module_access`
 * `member` row (which puts Attestation in their menu) plus one
 * `attestation_invites` row per test they may take. Managers are listed in the
 * managers panel, not here. RLS is on, so all reads and writes use the service
 * role after the manager check.
 */
export async function GET() {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("module_access")
    .select("user_id, granted_at, profile:profiles(full_name, email)")
    .eq("module", "attestation")
    .eq("access", "member")
    .order("granted_at", { ascending: false });
  if (error) return jsonError(error.message, 500);

  // Read invitations per chunk of teachers: one unfiltered read would be capped
  // at PostgREST's max-rows and silently drop subjects (max 15 tests × 50 < 1000).
  const byUser = new Map<string, string[]>();
  const ids = (members ?? []).map((m) => m.user_id as string);
  for (let i = 0; i < ids.length; i += 50) {
    const { data: invites, error: invErr } = await admin
      .from("attestation_invites")
      .select("user_id, test_id")
      .in("user_id", ids.slice(i, i + 50));
    if (invErr) return jsonError(invErr.message, 500);
    for (const r of invites ?? []) {
      const list = byUser.get(r.user_id as string) ?? [];
      list.push(r.test_id as string);
      byUser.set(r.user_id as string, list);
    }
  }
  return Response.json({
    takers: (members ?? []).map((m) => ({ ...m, test_ids: byUser.get(m.user_id as string) ?? [] })),
  });
}

const addSchema = z.object({
  emails: z.string().min(1).max(20000),
  test_ids: z.array(z.string().uuid()).min(1, "Choose at least one subject").max(100),
});

/**
 * Invite every pasted email to each chosen test, and email them.
 * - No account yet: one is created and the email carries a link that sets their
 *   password and opens their tests.
 * - Invited but no password chosen yet: a fresh link (re-inviting fixes an expired or
 *   scanner-consumed link), at most once per 10 minutes.
 * - Active account: an email pointing to their tests.
 */
export async function POST(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const { allowed } = await checkRateLimit(`attestation-takers:${user!.id}`, 60, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 60, windowSecs: 3600 });

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = addSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const { emails, invalid } = parseEmails(input.data.emails);
  if (emails.length === 0) return jsonError("No email addresses found", 400);
  if (emails.length > 300) return jsonError("At most 300 emails at a time", 400);

  const admin = createAdminClient();
  const testIds = Array.from(new Set(input.data.test_ids));
  const { data: tests, error: testErr } = await admin.from("attestation_tests").select("id, subject").in("id", testIds).eq("status", "published");
  if (testErr) return jsonError(testErr.message, 500);
  if ((tests ?? []).length !== testIds.length) return jsonError("Only published tests can be chosen — refresh the page", 400);

  const subjects = (tests ?? []).map((t) => t.subject as string);
  const origin = inviteLinkOrigin(new URL(req.url).origin, process.env.NEXT_PUBLIC_SITE_URL);

  let found;
  try {
    found = await profilesByEmail(emails);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Lookup failed", 500);
  }

  // Create accounts for emails that have none. Links are kept to email below.
  const links = new Map<string, string>();
  const created: string[] = [];
  const failed: { email: string; reason: string }[] = [];
  const missing = emails.filter((e) => !found.has(e));
  for (const e of missing.slice(MAX_NEW_ACCOUNTS)) failed.push({ email: e, reason: `Over ${MAX_NEW_ACCOUNTS} new accounts at once — invite again` });
  const toCreate = missing.slice(0, MAX_NEW_ACCOUNTS);
  for (let i = 0; i < toCreate.length; i += 10) {
    await Promise.all(
      toCreate.slice(i, i + 10).map(async (e) => {
        const quota = await checkRateLimit(`attestation-new-accounts:${user!.id}`, DAILY_NEW_ACCOUNTS, 24 * 60 * 60_000);
        if (!quota.allowed) {
          failed.push({ email: e, reason: `Daily limit of ${DAILY_NEW_ACCOUNTS} new accounts reached — try tomorrow` });
          return;
        }
        try {
          const acct = await createInvitedAccount(admin, e, origin);
          found.set(e, { id: acct.id, role: "learner" });
          links.set(e, acct.link);
          created.push(e);
        } catch (err) {
          failed.push({ email: e, reason: err instanceof Error ? err.message : "Could not create the account" });
        }
      }),
    );
  }

  const ids = emails.filter((e) => found.has(e)).map((e) => found.get(e)!.id);
  const [{ data: access }, { data: had }] = ids.length
    ? await Promise.all([
        admin.from("module_access").select("user_id, access").eq("module", "attestation").in("user_id", ids),
        admin.from("attestation_invites").select("user_id, test_id").in("user_id", ids).in("test_id", testIds),
      ])
    : [{ data: [] as { user_id: string; access: string }[] }, { data: [] as { user_id: string; test_id: string }[] }];
  const isManager = new Set((access ?? []).filter((r) => r.access === "ldm").map((r) => r.user_id));
  const existing = new Set((had ?? []).map((r) => `${r.user_id}:${r.test_id}`));

  const added: string[] = [];
  const already: string[] = [];
  const managers: string[] = [];
  const memberRows: { user_id: string; module: string; access: string }[] = [];
  const inviteRows: { user_id: string; test_id: string; invited_by: string }[] = [];
  for (const e of emails) {
    const p = found.get(e);
    if (!p) continue; // account creation failed; listed in `failed`
    // Managers and admins already see every test; inviting them would change nothing.
    if (p.role === "admin" || isManager.has(p.id)) {
      managers.push(e);
      continue;
    }
    // Always (re)write the member row: invitations without it would grant nothing,
    // e.g. after a manager was removed or a row was deleted elsewhere.
    memberRows.push({ user_id: p.id, module: "attestation", access: "member" });
    const fresh = testIds.filter((t) => !existing.has(`${p.id}:${t}`));
    if (fresh.length === 0) {
      already.push(e);
      continue;
    }
    for (const t of fresh) inviteRows.push({ user_id: p.id, test_id: t, invited_by: user!.id });
    added.push(e);
  }
  if (memberRows.length) {
    // ignoreDuplicates: never downgrade someone who became a manager meanwhile.
    const { error } = await admin.from("module_access").upsert(memberRows, { onConflict: "user_id,module", ignoreDuplicates: true });
    if (error) return jsonError(error.message, 500);
  }
  if (inviteRows.length) {
    const { error } = await admin.from("attestation_invites").upsert(inviteRows, { onConflict: "test_id,user_id", ignoreDuplicates: true });
    if (error) return jsonError(error.message, 500);
  }
  // Everyone invited gets an email — re-inviting is how a manager resends one.
  const toEmail = [...added, ...already];
  const recentlySent: string[] = [];
  const outbox: ReturnType<typeof attestationInviteEmail>[] = [];
  for (let i = 0; i < toEmail.length; i += 10) {
    await Promise.all(
      toEmail.slice(i, i + 10).map(async (e) => {
        try {
          let link = links.get(e) ?? null;
          if (!link) {
            const st = await inviteStanding(admin, found.get(e)!.id);
            if (st.pending && st.recentlySent) {
              recentlySent.push(e);
              return;
            }
            if (st.pending) link = await freshSetPasswordLink(admin, e, origin);
          }
          if (link) outbox.push(attestationInviteEmail({ to: e, subjects, url: link, newAccount: true }));
          else outbox.push(attestationInviteEmail({ to: e, subjects, url: `${origin}${ATTESTATION_LANDING}`, newAccount: false }));
        } catch (err) {
          failed.push({ email: e, reason: `Invited, but no email: ${err instanceof Error ? err.message : "link failed"}` });
        }
      }),
    );
  }
  const sent = outbox.length ? await sendEmailBatch(outbox) : { sent: 0, failed: [] };
  for (const f of sent.failed) failed.push({ email: f.to, reason: `Invited, but the email failed: ${f.reason}` });

  return Response.json({ added, created, already, managers, invalid, failed, recentlySent, emailed: sent.sent });
}

const removeSchema = z.object({ user_id: z.string().uuid(), test_id: z.string().uuid().optional() });

/**
 * Withdraw one invitation (`test_id`), or all of a teacher's invitations. A
 * teacher left with no invitations loses Attestation access entirely. Managers
 * are not removed here (an admin does that in the managers panel).
 */
export async function DELETE(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = removeSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);
  const { user_id, test_id } = input.data;

  const admin = createAdminClient();
  const { data: member, error: memErr } = await admin
    .from("module_access")
    .select("user_id")
    .eq("user_id", user_id)
    .eq("module", "attestation")
    .eq("access", "member")
    .maybeSingle();
  if (memErr) return jsonError(memErr.message, 500);
  if (!member) return jsonError("Not a test taker (managers are removed by an admin)", 404);

  let del = admin.from("attestation_invites").delete().eq("user_id", user_id);
  if (test_id) del = del.eq("test_id", test_id);
  const { error: delErr } = await del;
  if (delErr) return jsonError(delErr.message, 500);

  const { count, error: cntErr } = await admin
    .from("attestation_invites")
    .select("test_id", { count: "exact", head: true })
    .eq("user_id", user_id);
  if (cntErr) return jsonError(cntErr.message, 500);
  if ((count ?? 0) === 0) {
    const { error } = await admin
      .from("module_access")
      .delete()
      .eq("user_id", user_id)
      .eq("module", "attestation")
      .eq("access", "member");
    if (error) return jsonError(error.message, 500);
  }
  return Response.json({ ok: true, removedAccess: (count ?? 0) === 0 });
}
