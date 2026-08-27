import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MAX_BODY_BYTES = 1_048_576; // 1 MB

function bodySizeGuard(request: NextRequest): NextResponse | null {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.startsWith("multipart/form-data")) return null;
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (!isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  return null;
}

const SAME_DEPLOY_HOSTS = new Set([
  "dasavandir.org",
  "staging.dasavandir.org",
  "efficacy.dasavandir.org",
  "efficacy.staging.dasavandir.org",
]);

function csrfGuard(request: NextRequest): NextResponse | null {
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (host && originHost !== host) {
      // Allow cross-subdomain requests within the same deployment
      if (SAME_DEPLOY_HOSTS.has(originHost) && SAME_DEPLOY_HOSTS.has(host)) return null;
      if (originHost.includes("localhost") && host.includes("localhost")) return null;
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function isEfficacySubdomain(host: string): boolean {
  return (
    host === "efficacy.dasavandir.org" ||
    host === "efficacy.staging.dasavandir.org" ||
    host.startsWith("efficacy.localhost")
  );
}

export async function middleware(request: NextRequest) {
  const size = bodySizeGuard(request);
  if (size) return size;

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  // Subdomain routing: efficacy.dasavandir.org/* → /efficacy/*
  if (isEfficacySubdomain(host)) {
    if (!path.startsWith("/api/") && !path.startsWith("/auth/") && !path.startsWith("/_next/") && !path.startsWith("/efficacy")) {
      const url = request.nextUrl.clone();
      url.pathname = `/efficacy${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
  }

  // Only run Supabase auth for protected routes
  const needsAuth =
    path.startsWith("/admin") ||
    path.startsWith("/learn") ||
    path.startsWith("/efficacy") ||
    path === "/auth/login" ||
    path === "/auth/signup";

  if (!needsAuth) return NextResponse.next();

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
          cookiesToSet.forEach(({ name, value, options }) => {
            const { maxAge: _m, expires: _e, ...sessionOpts } = (options ?? {}) as Record<string, unknown>;
            supabaseResponse.cookies.set(name, value, sessionOpts as any);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && (path.startsWith("/admin") || path.startsWith("/learn") || path.startsWith("/efficacy"))) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (user && (path === "/auth/login" || path === "/auth/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Exclude static files — match everything else
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image).*)",
  ],
};
