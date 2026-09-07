import { test, expect } from "@playwright/test";
import { MODULES, moduleForHost, noAccess } from "../lib/modules";

/**
 * Subdomain routing is expressed twice — once in `lib/modules.ts` (the
 * registry) and once in `middleware.ts` (which reads that registry). It has
 * already broken once in production: `middleware.ts` checked
 * `efficacy.staging.dasavandir.org` while the real host is
 * `staging.efficacy.dasavandir.org`, so visitors to the staging efficacy
 * subdomain silently got the main LMS instead of the tool, with no error.
 *
 * These pin the exact host spellings and the host -> module mapping.
 */

test.describe("module subdomain registry", () => {
  test("staging hosts are staging.<module>.dasavandir.org, not <module>.staging.…", () => {
    for (const m of MODULES) {
      for (const host of m.hosts) {
        expect(host).not.toContain(`${m.id}.staging.`);
      }
    }
  });

  test("efficacy and gnahatum each declare a production and a staging host", () => {
    expect(moduleForHost("efficacy.dasavandir.org")?.id).toBe("efficacy");
    expect(moduleForHost("staging.efficacy.dasavandir.org")?.id).toBe("efficacy");
    expect(moduleForHost("gnahatum.dasavandir.org")?.id).toBe("gnahatum");
    expect(moduleForHost("staging.gnahatum.dasavandir.org")?.id).toBe("gnahatum");
  });

  test("the main hosts do not map to any module", () => {
    expect(moduleForHost("dasavandir.org")).toBeUndefined();
    expect(moduleForHost("staging.dasavandir.org")).toBeUndefined();
  });

  test("a port suffix does not defeat the host match", () => {
    expect(moduleForHost("efficacy.localhost:3000")?.id).toBe("efficacy");
    expect(moduleForHost("gnahatum.localhost:3000")?.id).toBe("gnahatum");
  });

  test("the old ararka host is not routed — the module was renamed", () => {
    expect(moduleForHost("ararka.dasavandir.org")).toBeUndefined();
  });

  test("every module's path prefix matches its id", () => {
    for (const m of MODULES) {
      if (m.id === "courses") continue; // courses lives at /learn
      expect(m.path).toBe(`/${m.id}`);
    }
  });

  test("noAccess() denies every module in the registry", () => {
    const grants = noAccess();
    for (const m of MODULES) {
      expect(grants[m.id]).toBe("none");
    }
  });
});
