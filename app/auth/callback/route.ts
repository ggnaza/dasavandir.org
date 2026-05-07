import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // After OAuth (Google etc.), ensure the profile has the correct role.
    // Supabase creates a new auth.users entry for OAuth even if the email already
    // exists as an email/password account, so the trigger may create a 'learner'
    // profile for an existing admin/creator. We fix that here.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const admin = createAdminClient();
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, role")
          .eq("email", user.email);

        if (profiles && profiles.length > 1) {
          // Multiple profiles for the same email — find the highest role and apply it
          const roleOrder = ["admin", "course_creator", "course_manager", "learner"];
          const best = profiles.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))[0];
          if (best.id !== user.id) {
            await admin.from("profiles").update({ role: best.role }).eq("id", user.id);
          }
        }
      }
    } catch (e) {
      console.error("[callback] role-sync error", e);
    }

    return supabaseResponse;
  }

  return NextResponse.redirect(new URL("/auth/login?error=no_code", request.url));
}
