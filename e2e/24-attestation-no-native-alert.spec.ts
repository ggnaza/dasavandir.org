import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Attestation screens must not use window.alert(). A native dialog freezes the
 * page until it is dismissed, so the Results page's Regrade alert left the list
 * showing a deleted attempt after Reset. Results are shown inline instead.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

test("attestation UI never calls alert()", () => {
  const root = join(__dirname, "..");
  const files = [...sources(join(root, "app/attestation")), ...sources(join(root, "components/attestation"))];
  expect(files.length).toBeGreaterThan(0);
  const offenders = files.filter((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .some((line) => !line.trim().startsWith("//") && /(^|[^.\w])alert\(/.test(line.replace(/\/\/.*$/, ""))),
  );
  expect(offenders).toEqual([]);
});
