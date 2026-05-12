import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Defensively ensure a profile row exists for the given auth user.
 *
 * Why this exists:
 * The `handle_new_user()` Postgres trigger has an `EXCEPTION WHEN OTHERS`
 * handler so it can never block user creation (see CLAUDE.md). The cost of
 * that safety is that the profile row may silently fail to be created.
 *
 * Any code path that creates an auth user OR depends on a profile row
 * (signup, OAuth callback, admin invite, enrollment, etc.) must call this
 * BEFORE doing anything that FK-references profiles(id).
 *
 * Requires the admin (service role) client — RLS would otherwise prevent
 * the insert for the user's own row in some configurations.
 */
export async function ensureProfile(
  admin: SupabaseClient,
  user: Pick<User, "id" | "email" | "user_metadata"> & { email?: string | null }
): Promise<void> {
  if (!user?.id) return;

  const fullName =
    (user.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
    (user.user_metadata as { full_name?: string; name?: string } | undefined)?.name ??
    null;

  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      role: "learner",
      status: "active",
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
}
