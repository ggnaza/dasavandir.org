#!/usr/bin/env node
/**
 * Import a weekly agenda spreadsheet into a course timetable.
 *
 *   node scripts/import-agenda.mjs <course-id> <file.xlsx> [--apply] [--up-to=YYYY-MM-DD]
 *                                                          [--keep-titles]
 *
 * Dry-run by default: prints the plan and writes nothing. Pass --apply to write.
 *
 * Uses the same lib/timetable/* code as the app, so what this runs is what ships.
 * Requires SUPABASE_SERVICE_ROLE_KEY (reads .env.local).
 *
 * TIMES ARE ARMENIA WALL-CLOCK and are carried through verbatim — see the timezone
 * contract in lib/timetable/parse-agenda-sheet.ts. Nothing here converts.
 *
 * Never announces. The daily agenda email is gated separately on
 * courses.timetable_daily_announcements.
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) throw new Error("No .env.local found");
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

/**
 * Grid adapter over an xlsx worksheet.
 *
 * Resolves merged ranges to their ANCHOR: a merged block covers many cells but is
 * one session, so returning its value for every covered cell would emit duplicates
 * (36 of them on the real TLA workbook).
 */
function gridFor(wb, name) {
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const covered = new Map();
  for (const m of ws["!merges"] || []) {
    for (let r = m.s.r; r <= m.e.r; r++)
      for (let c = m.s.c; c <= m.e.c; c++)
        covered.set(`${r},${c}`, `${m.s.r},${m.s.c}`);
  }
  return {
    name,
    maxRow: range.e.r + 1,
    maxCol: range.e.c + 1,
    cell: (row, col) => {
      const r = row - 1, c = col - 1;
      const key = `${r},${c}`;
      const anchor = covered.get(key);
      if (anchor && anchor !== key) return undefined;
      return ws[XLSX.utils.encode_cell({ r, c })]?.v;
    },
  };
}

const args = process.argv.slice(2);
const courseId = args[0];
const filePath = args[1];
const apply = args.includes("--apply");
const keepTitles = args.includes("--keep-titles");
const upTo = args.find((a) => a.startsWith("--up-to="))?.split("=")[1];

if (!courseId || !filePath) {
  console.error("usage: node scripts/import-agenda.mjs <course-id> <file.xlsx> [--apply] [--up-to=YYYY-MM-DD] [--keep-titles]");
  process.exit(1);
}

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { parseSheet } = require("../.import-build/parse-agenda-sheet.js");
const { planImport, applyImport } = require("../.import-build/import-agenda.js");

const wb = XLSX.read(fs.readFileSync(filePath), { cellDates: true });
const expectYear = new Date().getFullYear();

let parsed = [], skipped = [];
for (const name of wb.SheetNames) {
  const res = parseSheet(gridFor(wb, name), { expectYear });
  parsed.push(...res.entries);
  skipped.push(...res.skipped);
}

const dates = [...new Set(parsed.map((e) => e.date))].sort();
console.log(`\nParsed ${parsed.length} entries over ${dates.length} days (${dates[0]} → ${dates[dates.length - 1]})`);
console.log(`Skipped ${skipped.length}:`, JSON.stringify(
  skipped.reduce((a, s) => ((a[s.reason] = (a[s.reason] || 0) + 1), a), {}),
));

const dupes = parsed.length - new Set(parsed.map((e) => e.sourceKey)).size;
if (dupes) { console.error(`ABORT: ${dupes} duplicate sourceKeys — merges not collapsing.`); process.exit(1); }

const plan = await planImport(admin, courseId, parsed);
console.log(`\nPLAN  adopt ${plan.adopt.length} · update ${plan.update.length} · insert ${plan.insert.length} · orphan ${plan.orphan.length} (left alone)`);
if (upTo) console.log(`      limited to dates <= ${upTo}`);
if (!keepTitles && plan.adopt.length) {
  const changed = plan.adopt.filter((a) => a.oldTitle.replace(/\s+/g, " ").trim() !== a.entry.title);
  console.log(`      ${changed.length} existing title(s) would be overwritten by the sheet`);
}

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.\n");
  process.exit(0);
}

const result = await applyImport(admin, courseId, plan, { overwriteTitles: !keepTitles, upToDate: upTo });
console.log("\nAPPLIED:", JSON.stringify(result));
