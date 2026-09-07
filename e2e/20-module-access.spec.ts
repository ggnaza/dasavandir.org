import { test, expect } from "@playwright/test";
import { MODULE_IDS, MODULES, type AccessLevel, type ModuleId } from "../lib/modules";
import { allowedModules, canEnter, isLdmIn } from "../lib/access/module-access";

/**
 * Per-module access replaced three overlapping mechanisms (a `profiles.modules`
 * array, a global `is_ldm` boolean, and "course_manager implies Gnahatum LDM").
 * The point of the replacement is that a grant can differ per module — LDM in
 * Efficacy while an ordinary member, or absent, in Gnahatum.
 *
 * These exercise the pure grant logic. `getModuleGrants` itself hits Supabase
 * and is covered by the app's own runtime paths.
 */

function grants(over: Partial<Record<ModuleId, AccessLevel>>) {
  return { courses: "none", efficacy: "none", gnahatum: "none", ...over } as Record<
    ModuleId,
    AccessLevel
  >;
}

test.describe("module grants", () => {
  test("LDM in one module is not LDM in another", () => {
    const g = grants({ efficacy: "ldm", gnahatum: "member" });
    expect(isLdmIn(g, "efficacy")).toBe(true);
    expect(isLdmIn(g, "gnahatum")).toBe(false);
    expect(canEnter(g, "gnahatum")).toBe(true);
  });

  test("a module with no grant cannot be entered", () => {
    const g = grants({ efficacy: "ldm" });
    expect(canEnter(g, "gnahatum")).toBe(false);
    expect(canEnter(g, "courses")).toBe(false);
  });

  test("allowedModules lists exactly the granted modules, in registry order", () => {
    expect(allowedModules(grants({ courses: "member", gnahatum: "ldm" }))).toEqual([
      "courses",
      "gnahatum",
    ]);
    expect(allowedModules(grants({}))).toEqual([]);
  });

  test("every registry module is representable in a grant map", () => {
    const g = grants({});
    for (const id of MODULE_IDS) {
      expect(g[id]).toBe("none");
    }
    expect(MODULE_IDS.length).toBe(MODULES.length);
  });

  test("the admin UI has a label for both levels of every module", () => {
    for (const m of MODULES) {
      expect(m.memberLabel.length).toBeGreaterThan(0);
      expect(m.ldmLabel.length).toBeGreaterThan(0);
    }
  });
});
