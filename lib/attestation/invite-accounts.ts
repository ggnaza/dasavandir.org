/**
 * Accounts and emails for attestation invitations (ADR-0011 amendment). Server only.
 *
 * A teacher with no dasavandir.org account gets one created from the invitation:
 * Supabase generates a one-time link that sets their password on /auth/set-password
 * and then lands them on /attestation, where their invited tests wait with a Start
 * button. Until they choose a password (`app_metadata.invite_accepted`, set by
 * /api/auth/activate), every re-invite sends a fresh link — so a link that expired,
 * or that an email scanner consumed, is fixed by inviting again.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureProfile } from "@/lib/auth/ensure-profile";

export const ATTESTATION_LANDING = "/attestation";

/** A fresh link is not re-sent within this window (repeated pastes must not spam). */
export const RESEND_COOLDOWN_MS = 10 * 60_000;

/** Where the one-time link sends the invitee: set a password, then their tests. */
export function setPasswordRedirect(origin: string): string {
  return `${origin}/auth/set-password?next=${encodeURIComponent(ATTESTATION_LANDING)}`;
}

async function readyProfile(admin: SupabaseClient, user: User): Promise<void> {
  // The signup trigger only warns on failure (CLAUDE.md): make sure the profile exists
  // before anything FK-references it. Invited accounts are `active` — never pending —
  // so the 24h unverified-account cleanup cannot delete them before they accept.
  await ensureProfile(admin, user);
  const { error } = await admin.from("profiles").update({ status: "active" }).eq("id", user.id);
  if (error) throw new Error(error.message);
}

/**
 * Create an account for an email with no profile, and return its id and one-time link.
 * An auth user that exists without a profile (a failed trigger) is repaired instead.
 */
export async function createInvitedAccount(admin: SupabaseClient, email: string, origin: string): Promise<{ id: string; link: string }> {
  const redirectTo = setPasswordRedirect(origin);
  const invited = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  let user = invited.data?.user ?? null;
  let link = invited.data?.properties?.action_link ?? null;
  if (invited.error || !user || !link) {
    // "Already registered": the auth user exists but its profile is missing.
    const magic = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    if (magic.error || !magic.data?.user || !magic.data.properties?.action_link) {
      throw new Error(invited.error?.message ?? magic.error?.message ?? "Could not create the account");
    }
    user = magic.data.user;
    link = magic.data.properties.action_link;
  }
  await readyProfile(admin, user);
  await markLinkSent(admin, user);
  return { id: user.id, link };
}

export interface InviteStanding {
  /** Invited but has not chosen a password yet: needs a (fresh) link, not the tests page. */
  pending: boolean;
  /** A link went out within RESEND_COOLDOWN_MS. */
  recentlySent: boolean;
}

export async function inviteStanding(admin: SupabaseClient, userId: string, now = Date.now()): Promise<InviteStanding> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { pending: false, recentlySent: false };
  const meta = (data.user.app_metadata ?? {}) as { invite_accepted?: boolean; attestation_link_sent_at?: string };
  const pending = Boolean(data.user.invited_at) && !meta.invite_accepted;
  const sentAt = meta.attestation_link_sent_at ? Date.parse(meta.attestation_link_sent_at) : NaN;
  return { pending, recentlySent: Number.isFinite(sentAt) && now - sentAt < RESEND_COOLDOWN_MS };
}

/** A fresh one-time link for an account that has not accepted its invitation yet. */
export async function freshSetPasswordLink(admin: SupabaseClient, email: string, origin: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: setPasswordRedirect(origin) },
  });
  if (error || !data?.properties?.action_link || !data.user) throw new Error(error?.message ?? "Could not create a sign-in link");
  await markLinkSent(admin, data.user);
  return data.properties.action_link;
}

async function markLinkSent(admin: SupabaseClient, user: User): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), attestation_link_sent_at: new Date().toISOString() },
  });
  if (error) console.error("[attestation invite] could not record link time", error.message);
}
