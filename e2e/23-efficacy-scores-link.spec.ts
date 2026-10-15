import { test, expect } from "@playwright/test";
import { MODULES, moduleUrl, switcherHref } from "../lib/modules";

/**
 * The admin Activity page links a teacher to the Efficacy tool, which now runs as its own
 * deployment (ggnaza/efficacy, ADR-0009). Staging must link to staging — a staging admin landing
 * on production Efficacy would be looking at (and could edit) production-only state by mistake.
 */
test.describe("moduleUrl", () => {
  test("production hosts link to the production efficacy subdomain", () => {
    expect(moduleUrl("efficacy", "dasavandir.org")).toBe("https://efficacy.dasavandir.org");
    expect(moduleUrl("efficacy", "www.dasavandir.org")).toBe("https://efficacy.dasavandir.org");
  });

  test("staging hosts link to the staging efficacy subdomain", () => {
    expect(moduleUrl("efficacy", "staging.dasavandir.org")).toBe("https://staging.efficacy.dasavandir.org");
    expect(moduleUrl("efficacy", "staging.dasavandir.org:443")).toBe("https://staging.efficacy.dasavandir.org");
  });

  test("the LMS itself has no module subdomain", () => {
    expect(moduleUrl("courses", "dasavandir.org")).toBeNull();
  });
});

/**
 * The module switcher used to send users to `/efficacy` on the LMS host — the old in-LMS rebuild —
 * even after Efficacy moved to its own deployment. It must go to the Efficacy subdomain instead.
 */
test.describe("switcherHref", () => {
  const efficacy = MODULES.find((m) => m.id === "efficacy")!;
  const gnahatum = MODULES.find((m) => m.id === "gnahatum")!;

  test("efficacy is a standalone module", () => {
    expect(efficacy.standalone).toBe(true);
    expect(gnahatum.standalone).toBeFalsy();
  });

  test("staging LMS → staging efficacy subdomain", () => {
    expect(switcherHref(efficacy, "staging.dasavandir.org")).toBe("https://staging.efficacy.dasavandir.org");
    expect(switcherHref(efficacy, "staging.gnahatum.dasavandir.org")).toBe("https://staging.efficacy.dasavandir.org");
  });

  test("production LMS → production efficacy subdomain", () => {
    expect(switcherHref(efficacy, "www.dasavandir.org")).toBe("https://efficacy.dasavandir.org");
    expect(switcherHref(efficacy, "dasavandir.org")).toBe("https://efficacy.dasavandir.org");
  });

  test("local development keeps the in-app path", () => {
    expect(switcherHref(efficacy, "localhost:3000")).toBe("/efficacy");
    expect(switcherHref(efficacy, "gnahatum.localhost:3000")).toBe("/efficacy");
  });

  test("non-standalone modules stay paths on this app", () => {
    expect(switcherHref(gnahatum, "staging.dasavandir.org")).toBe("/gnahatum");
  });
});
