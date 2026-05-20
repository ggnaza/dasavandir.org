import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/learn";

  // Supabase redirects here with error params when OAuth fails (e.g. trigger error)
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");
  if (oauthError || oauthErrorDescription) {
    const msg = oauthErrorDescription || oauthError || "Sign-in failed";
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  const redirectTo = new URL(next, request.url);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.redirect(redirectTo);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let supabaseResponse = NextResponse.redirect(redirectTo);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "recovery" | "invite" | "magiclink" | "email_change" });
    if (error) {
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return supabaseResponse;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url));
    }

    // Defensive: ensure a profile row exists in case the handle_new_user trigger
    // silently failed. Role-sync (picking the best role across same-email profiles)
    // is handled by the trigger itself — no listUsers scan needed here.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        await ensureProfile(admin, user);
      }
    } catch (e) {
      console.error("[callback] ensureProfile error", e);
    }

    return supabaseResponse;
  }

  return NextResponse.redirect(new URL("/auth/login?error=no_code", request.url));
}
