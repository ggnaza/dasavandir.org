/**
 * Look up accounts by pasted email, for the teachers and managers panels. Server only.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export interface FoundProfile {
  id: string;
  role: string;
}

/**
 * Map each email that has an account to its profile. Profile emails are stored
 * lower-case (Supabase normalises auth emails) and parseEmails lower-cases input,
 * so an exact `in` match is case-insensitive in effect — and, unlike `ilike`,
 * does not treat `_` as a wildcard.
 */
export async function profilesByEmail(emails: string[]): Promise<Map<string, FoundProfile>> {
  const admin = createAdminClient();
  const found = new Map<string, FoundProfile>();
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data, error } = await admin.from("profiles").select("id, email, role").in("email", chunk);
    if (error) throw new Error(error.message, { cause: error });
    for (const p of data ?? []) found.set(String(p.email).toLowerCase(), { id: p.id as string, role: p.role as string });
  }
  return found;
}
