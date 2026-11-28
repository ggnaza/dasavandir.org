import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessAdmin, getAttestationUser, jsonError, readJson, zodMessage } from "@/lib/attestation/server";
import { profilesByEmail } from "@/lib/attestation/people";
import { parseEmails } from "@/lib/attestation-core";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Attestation managers (`module_access` access = 'ldm'): they build tests, invite
 * teachers and see every result. Only platform admins add or remove them, so
 * staff access cannot spread manager-to-manager (ADR-0011).
 */
export async function GET() {
  const user = await getAttestationUser();
  const denied = denyUnlessAdmin(user);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("module_access")
    .select("user_id, granted_at, profile:profiles(full_name, email)")
    .eq("module", "attestation")
    .eq("access", "ldm")
    .order("granted_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return Response.json({ managers: data ?? [] });
}

const addSchema = z.object({ emails: z.string().min(1).max(5000) });

/** Make every pasted email that has an account an attestation manager. */
export async function POST(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessAdmin(user);
  if (denied) return denied;

  const { allowed } = await checkRateLimit(`attestation-managers:${user!.id}`, 30, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 30, windowSecs: 3600 });

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = addSchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const { emails, invalid } = parseEmails(input.data.emails);
  if (emails.length === 0) return jsonError("No email addresses found", 400);
  if (emails.length > 50) return jsonError("At most 50 managers at a time", 400);

  let found;
  try {
    found = await profilesByEmail(emails);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Lookup failed", 500);
  }

  const admin = createAdminClient();
  const ids = emails.filter((e) => found.has(e)).map((e) => found.get(e)!.id);
  const { data: existing } = ids.length
    ? await admin.from("module_access").select("user_id").eq("module", "attestation").eq("access", "ldm").in("user_id", ids)
    : { data: [] as { user_id: string }[] };
  const isManager = new Set((existing ?? []).map((r) => r.user_id));

  const added: string[] = [];
  const already: string[] = [];
  const notFound: string[] = [];
  const rows: { user_id: string; module: string; access: string }[] = [];
  for (const e of emails) {
    const p = found.get(e);
    if (!p) notFound.push(e);
    else if (p.role === "admin" || isManager.has(p.id)) already.push(e);
    else {
      rows.push({ user_id: p.id, module: "attestation", access: "ldm" });
      added.push(e);
    }
  }
  if (rows.length) {
    // Not ignoreDuplicates: an invited teacher is promoted from member to manager.
    const { error } = await admin.from("module_access").upsert(rows, { onConflict: "user_id,module" });
    if (error) return jsonError(error.message, 500);
  }
  return Response.json({ added, already, notFound, invalid });
}

const removeSchema = z.object({ user_id: z.string().uuid() });

/** Remove a manager. They lose Attestation access entirely; invite them as a teacher to give some back. */
export async function DELETE(req: Request) {
  const user = await getAttestationUser();
  const denied = denyUnlessAdmin(user);
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
    .eq("access", "ldm")
    .select("user_id");
  if (error) return jsonError(error.message, 500);
  if (!data?.length) return jsonError("Not an attestation manager", 404);
  return Response.json({ ok: true });
}
