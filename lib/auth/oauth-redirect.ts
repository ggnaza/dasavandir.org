/**
 * Build the `redirectTo` URL handed to `supabase.auth.signInWithOAuth`.
 *
 * MUST derive the origin from `window.location.origin` — never from
 * `NEXT_PUBLIC_SITE_URL`. That env var is inlined at build time, so a staging
 * build made with the production value silently sends every SSO login to
 * production. That is exactly what happened: the staging bundle shipped
 * `redirectTo: "https://dasavandir.org/auth/callback"`, so signing in from
 * staging.dasavandir.org landed the user on prod.
 *
 * Client-side only — `window` must exist at the call site.
 */
export function oauthCallbackUrl(next?: string | null): string {
  const url = new URL("/auth/callback", window.location.origin);
  // Only relative paths; `//evil.com` is protocol-relative and would be an
  // open redirect.
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}
