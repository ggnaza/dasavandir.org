import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/learn";

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
    // Email link flow (confirm signup, magic link, password reset)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "recovery" | "invite" | "magiclink" | "email_change" });
    if (error) {
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return supabaseResponse;
  }

  if (code) {
    // OAuth / PKCE code flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
    return supabaseResponse;
  }

  return NextResponse.redirect(new URL("/auth/login?error=no_code", request.url));
}
