/**
 * The module registry — the single source of truth for what a "module" is.
 *
 * dasavandir.org hosts three products behind one Next.js deployment: the LMS
 * (Courses), the Teacher Efficacy tool, and Gnahatum (test scanning/scoring,
 * formerly "Ararka"). Each is reachable both as a path on the main host and on
 * its own subdomain. Middleware, the nav switcher and the admin access UI all
 * read this list, so adding a module is one edit here plus its route folder.
 *
 * Safe to import from client components — no Node.js dependencies.
 */

export type ModuleId = "courses" | "efficacy" | "gnahatum";

/** What a user may do inside a module. `none` means the module is hidden. */
export type AccessLevel = "none" | "member" | "ldm";

export interface ModuleDef {
  id: ModuleId;
  /** Name shown in the switcher and the admin UI. */
  label: string;
  /** Route prefix on the main host. */
  path: string;
  /** Where the switcher sends a user who picks this module. */
  href: string;
  /** Accent colour for the switcher dot. */
  color: string;
  /** What `member` is called inside this module, for the admin UI. */
  memberLabel: string;
  /** What `ldm` is called inside this module, for the admin UI. */
  ldmLabel: string;
  /** Production and staging subdomains that rewrite onto `path`. */
  hosts: string[];
  /** Local dev subdomain prefix. */
  localHost: string;
  /**
   * Runs as its own deployment (its own repo + Vercel project), not as routes of this app, so
   * links to it must go to its subdomain — `path` here only serves the legacy in-LMS copy.
   */
  standalone?: boolean;
}

export const MODULES: ModuleDef[] = [
  {
    id: "courses",
    label: "Courses",
    path: "/learn",
    href: "/learn",
    color: "#2563EB",
    memberLabel: "Learner",
    ldmLabel: "Manager",
    hosts: [],
    localHost: "",
  },
  {
    id: "efficacy",
    label: "Efficacy",
    path: "/efficacy",
    href: "/efficacy",
    color: "#EC5328",
    memberLabel: "Teacher",
    ldmLabel: "LDM",
    hosts: ["efficacy.dasavandir.org", "staging.efficacy.dasavandir.org"],
    localHost: "efficacy.localhost",
    // Vahe's original tool, re-hosted as its own Vercel project (ggnaza/efficacy, ADR-0009).
    standalone: true,
  },
  {
    id: "gnahatum",
    label: "Gnahatum",
    path: "/gnahatum",
    href: "/gnahatum",
    color: "#059669",
    memberLabel: "Teacher",
    ldmLabel: "LDM",
    hosts: ["gnahatum.dasavandir.org", "staging.gnahatum.dasavandir.org"],
    localHost: "gnahatum.localhost",
  },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

/** The module a request host maps to, or undefined for the main host. */
export function moduleForHost(host: string): ModuleDef | undefined {
  const bare = host.split(":")[0];
  return MODULES.find((m) => m.hosts.includes(bare) || (m.localHost && bare === m.localHost));
}

/**
 * Absolute URL of a module's own subdomain for the environment serving `currentHost`:
 * staging hosts (`staging.…`) link to the module's staging host, everything else to production.
 * Null for a module without subdomains (the LMS itself).
 */
export function moduleUrl(id: ModuleId, currentHost: string): string | null {
  const mod = moduleById(id);
  if (!mod || mod.hosts.length === 0) return null;
  const isStaging = currentHost.split(":")[0].startsWith("staging.");
  const host = mod.hosts.find((h) => h.startsWith("staging.") === isStaging) ?? mod.hosts[0];
  return `https://${host}`;
}

/**
 * Where the module switcher should send a user for `mod`, given the host they are on.
 * A standalone module lives on its own subdomain (staging → staging.<module>, otherwise
 * production); everything else — and any module during local development — is a path on this app.
 */
export function switcherHref(mod: ModuleDef, currentHost: string): string {
  const bare = currentHost.split(":")[0];
  const isLocal = bare === "localhost" || bare.endsWith(".localhost") || bare === "127.0.0.1";
  if (mod.standalone && !isLocal) return moduleUrl(mod.id, currentHost) ?? mod.href;
  return mod.href;
}

/** An empty grant map — every module denied. Callers layer grants on top. */
export function noAccess(): Record<ModuleId, AccessLevel> {
  return { courses: "none", efficacy: "none", gnahatum: "none" };
}
