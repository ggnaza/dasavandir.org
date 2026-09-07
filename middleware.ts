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

/**
 * Module subdomains, in `<host> -> <path prefix>` form.
 *
 * Each module is reachable both as a path on the main host (`/efficacy/...`)
 * and on its own subdomain, which middleware rewrites onto that path. The
 * staging hosts are `staging.<module>.dasavandir.org` — NOT
 * `<module>.staging.dasavandir.org`; getting that backwards silently serves
 * the main LMS on the module subdomain instead of the module.
 */
const MODULE_SUBDOMAINS: { hosts: string[]; localPrefix: string; path: string }[] = [
  {
    hosts: ["efficacy.dasavandir.org", "staging.efficacy.dasavandir.org"],
    localPrefix: "efficacy.localhost",
    path: "/efficacy",
  },
  {
    hosts: ["gnahatum.dasavandir.org", "staging.gnahatum.dasavandir.org"],
    localPrefix: "gnahatum.localhost",
    path: "/gnahatum",
  },
];

const SAME_DEPLOY_HOSTS = new Set([
  "dasavandir.org",
  "staging.dasavandir.org",
  ...MODULE_SUBDOMAINS.flatMap((m) => m.hosts),
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

/** The module path a request's host maps to, or null when it is the main host. */
function moduleSubdomainPath(host: string): string | null {
  const bare = host.split(":")[0];
  for (const m of MODULE_SUBDOMAINS) {
    if (m.hosts.includes(bare) || bare === m.localPrefix) return m.path;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const size = bodySizeGuard(request);
  if (size) return size;

  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  // Subdomain routing: <module>.dasavandir.org/* → /<module>/*
  const modulePath = moduleSubdomainPath(host);
  if (modulePath) {
    if (
      !path.startsWith("/api/") &&
      !path.startsWith("/auth/") &&
      !path.startsWith("/_next/") &&
      !path.startsWith(modulePath)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `${modulePath}${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
  }

  // Only run Supabase auth for protected routes
  const needsAuth =
    path.startsWith("/admin") ||
    path.startsWith("/learn") ||
    path.startsWith("/efficacy") ||
    path.startsWith("/gnahatum") ||
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

  if (!user && (path.startsWith("/admin") || path.startsWith("/learn") || path.startsWith("/efficacy") || path.startsWith("/gnahatum"))) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
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
