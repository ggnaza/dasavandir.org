import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BODY_BYTES = 1_048_576; // 1 MB

function bodySizeGuard(request: NextRequest): NextResponse | null {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return null;
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  return null;
}

// Reject cross-origin mutation requests (CSRF protection).
function csrfGuard(request: NextRequest): NextResponse | null {
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null; // server-to-server or direct calls — allow

  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (host && originHost !== host) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const size = bodySizeGuard(request);
  if (size) return size;

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes
  if (!user && (path.startsWith("/admin") || path.startsWith("/learn"))) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Redirect authenticated users away from auth pages
  if (user && (path === "/auth/login" || path === "/auth/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/learn/:path*", "/auth/:path*", "/api/:path*"],
};
