/**
 * Accounts and emails for attestation invitations (ADR-0011 amendment). Server only.
 *
 * A teacher with no dasavandir.org account gets one created from the invitation:
 * Supabase generates a one-time link that sets their password on /auth/set-password
 * and then lands them on /attestation, where their invited tests wait with a Start
 * button. Anyone who has never signed in gets a fresh link on every re-invite, so an
 * expired link is fixed by inviting again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfile } from "@/lib/auth/ensure-profile";

export const ATTESTATION_LANDING = "/attestation";

/** Where the one-time link sends the invitee: set a password, then their tests. */
export function setPasswordRedirect(origin: string): string {
  return `${origin}/auth/set-password?next=${encodeURIComponent(ATTESTATION_LANDING)}`;
}

/**
 * Create an account for an email with none, and return its id and one-time link.
 * Throws with Supabase's message (e.g. an auth user exists but has no profile).
 */
export async function createInvitedAccount(admin: SupabaseClient, email: string, origin: string): Promise<{ id: string; link: string }> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: setPasswordRedirect(origin) },
  });
  if (error || !data?.user) throw new Error(error?.message ?? "Could not create the account");
  // The signup trigger only warns on failure (CLAUDE.md): make sure the profile exists
  // before anything FK-references it. Invited accounts are `active` — never pending —
  // so the 24h unverified-account cleanup cannot delete them before they accept.
  await ensureProfile(admin, data.user);
  const { error: stErr } = await admin.from("profiles").update({ status: "active" }).eq("id", data.user.id);
  if (stErr) throw new Error(stErr.message);
  return { id: data.user.id, link: data.properties.action_link };
}

/** True when the account has never signed in (an invitation not yet accepted). */
export async function neverSignedIn(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  return !data.user.last_sign_in_at;
}

/** A fresh one-time sign-in link for an account that has not accepted its invitation yet. */
export async function freshSetPasswordLink(admin: SupabaseClient, email: string, origin: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: setPasswordRedirect(origin) },
  });
  if (error || !data?.properties?.action_link) throw new Error(error?.message ?? "Could not create a sign-in link");
  return data.properties.action_link;
}
