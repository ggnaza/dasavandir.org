/**
 * When Supabase does not accept the `redirectTo` an OAuth sign-in asked for (it is
 * not on the project's Redirect URLs list), it falls back to the Site URL — the
 * homepage — with the auth result still in the query (`?code=…`, or `?error=…`).
 * The homepage would ignore it and the user would land signed out.
 *
 * Returns the /auth/callback URL to forward those params to, or null when the
 * request carries none. The callback then exchanges the code (or shows the error),
 * exactly as if Supabase had redirected there directly.
 */
const AUTH_PARAMS = ["code", "error", "error_code", "error_description"];

export function callbackForStrayAuthParams(params: Record<string, string | string[] | undefined>): string | null {
  const out = new URLSearchParams();
  for (const key of AUTH_PARAMS) {
    const v = params[key];
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out.set(key, value);
  }
  if (!out.has("code") && !out.has("error") && !out.has("error_description")) return null;
  const next = params.next;
  const nextValue = Array.isArray(next) ? next[0] : next;
  // Same rule as the login page: only a same-site relative path.
  if (nextValue && nextValue.startsWith("/") && !nextValue.startsWith("//")) out.set("next", nextValue);
  return `/auth/callback?${out.toString()}`;
}
