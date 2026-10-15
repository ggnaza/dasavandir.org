import { test, expect } from "@playwright/test";
import { moduleUrl } from "../lib/modules";

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
