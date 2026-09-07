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

/** An empty grant map — every module denied. Callers layer grants on top. */
export function noAccess(): Record<ModuleId, AccessLevel> {
  return { courses: "none", efficacy: "none", gnahatum: "none" };
}
