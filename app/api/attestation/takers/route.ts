import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { parseEmails } from "@/lib/attestation-core";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Who may take attestation tests. Managers (admins and attestation LDMs) add
 * teachers by email here, so granting access does not need a platform admin.
 * Rows live in `module_access` (module = 'attestation'); RLS is on, so every read
 * and write goes through the service role after the manager check.
 */
export async function GET() {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_access")
    .select("user_id, access, granted_at, profile:profiles(full_name, email)")
    .eq("module", "attestation")
    .order("granted_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return Response.json({ takers: data ?? [] });
}

const addSchema = z.object({ emails: z.string().min(1).max(20000) });

/** Grant test-taker access to every pasted email that has an account. */
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
  // Profile emails are stored lower-case (Supabase normalises auth emails), and
  // parseEmails lower-cases input, so an exact match is case-insensitive in effect.
  const found = new Map<string, { id: string; role: string }>();
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await admin.from("profiles").select("id, email, role").in("email", chunk);
    if (error) return jsonError(error.message, 500);
    for (const p of data ?? []) found.set(String(p.email).toLowerCase(), { id: p.id, role: p.role });
  }

  const ids = emails.filter((e) => found.has(e)).map((e) => found.get(e)!.id);
  const { data: existing } = ids.length
    ? await admin.from("module_access").select("user_id, access").eq("module", "attestation").in("user_id", ids)
    : { data: [] as { user_id: string; access: string }[] };
  const had = new Map((existing ?? []).map((r) => [r.user_id, r.access]));

  const added: string[] = [];
  const already: string[] = [];
  const notFound: string[] = [];
  const rows: { user_id: string; module: string; access: string }[] = [];
  for (const e of emails) {
    const p = found.get(e);
    if (!p) notFound.push(e);
    else if (p.role === "admin" || had.has(p.id)) already.push(e);
    else {
      rows.push({ user_id: p.id, module: "attestation", access: "member" });
      added.push(e);
    }
  }
  if (rows.length) {
    // ignoreDuplicates: never downgrade someone who became a manager meanwhile.
    const { error } = await admin.from("module_access").upsert(rows, { onConflict: "user_id,module", ignoreDuplicates: true });
    if (error) return jsonError(error.message, 500);
  }
  return Response.json({ added, already, notFound, invalid });
}

const removeSchema = z.object({ user_id: z.string().uuid() });

/** Remove a teacher's access. Managers are not removed here (an admin does that). */
export async function DELETE(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = removeSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_access")
    .delete()
    .eq("user_id", input.data.user_id)
    .eq("module", "attestation")
    .eq("access", "member")
    .select("user_id");
  if (error) return jsonError(error.message, 500);
  if (!data?.length) return jsonError("Not a test taker (managers are removed by an admin)", 404);
  return Response.json({ ok: true });
}
