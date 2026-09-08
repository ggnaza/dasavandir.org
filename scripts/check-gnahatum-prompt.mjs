#!/usr/bin/env node
/**
 * Guards the partial-credit contract in the Gnahatum scoring prompt.
 *
 * WHY THIS EXISTS: the scorer graded every question all-or-nothing. It never
 * emitted 0.25 or 0.75 on any scan, despite 91 questions across 28 seed tests
 * carrying rubrics that explicitly award in quarter-point steps ("Found roots
 * 0.25, constructed graph 0.25"). The cause was entirely in the prompt — it
 * listed the point distribution as "FIXED per question number", which reads as
 * the set of legal awards, and rendered the per-question rubric as a passive
 * "Scoring note:" that no rule ever told the model to apply.
 *
 * The repo has no unit-test runner (only Playwright e2e), so this follows the
 * existing standalone-script convention alongside build-gnahatum-keys-sql.mjs.
 * It asserts the prompt still carries the contract and that the corpus still
 * carries the rubrics that depend on it.
 *
 * Run: node scripts/check-gnahatum-prompt.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCORER = "lib/gnahatum/scorer.ts";
const KEYS_DIR = "supabase/seed-data/gnahatum-keys";

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const src = readFileSync(SCORER, "utf8");

// --- the prompt must authorise sub-half-point awards ---
check(
  /Any multiple of 0\.25 from 0 up to that maximum is a valid award/.test(src),
  "prompt no longer states that any 0.25 multiple is a valid award",
);
check(
  /0, 0\.25, 0\.5, 0\.75 or 1/.test(src),
  "prompt no longer spells out the legal awards for a 1-point question",
);
check(
  /PARTIAL CREDIT IS THE NORM, NOT THE EXCEPTION/.test(src),
  "prompt no longer leads with the partial-credit instruction",
);

// --- the phrasings that caused the bug must not come back ---
check(
  !/Point distribution is FIXED per question number/.test(src),
  'prompt reintroduced "Point distribution is FIXED per question number" — reads as an enum of legal awards',
);
check(
  !/partial credit in 0\.5 increments/.test(src),
  'prompt reintroduced the "0.5 increments" cap on essay credit',
);
check(
  !/Scoring note: \$\{q\.scoring_notes\}/.test(src),
  'per-question rubric labelled "Scoring note" again — it must read as HOW TO AWARD',
);
check(
  /HOW TO AWARD: \$\{q\.scoring_notes\}/.test(src),
  "per-question rubric is no longer rendered as HOW TO AWARD",
);
check(
  /that line is the authoritative rubric/.test(src),
  "prompt no longer makes the per-question rubric authoritative",
);

// --- the answer key, not the fixed table, decides a question's maximum ---
check(
  /maxByNumber\.get\(item\.number\) \?\? POINT_DISTRIBUTION/.test(src),
  "max_points no longer prefers the answer key over POINT_DISTRIBUTION — questions past Q15 will clamp to 0",
);

// --- Gemini must get guaranteed JSON, and Gemini 3 must get full-resolution scans ---
check(
  /responseMimeType: "application\/json"/.test(src) && /responseSchema: GEMINI_RESPONSE_SCHEMA/.test(src),
  "Gemini structured output was removed — the response falls back to fragile regex extraction",
);
check(
  /media_resolution = "MEDIA_RESOLUTION_HIGH"/.test(src),
  "Gemini 3 scans are no longer requested at high media resolution",
);

// --- the truncation guards must stay ---
check(
  /maxOutputTokens: 32768/.test(src),
  "output budget dropped below 32768 — thinking tokens share it and a smaller budget truncated the JSON",
);
check(
  /thinkingConfig = \{ thinkingBudget: 8192 \}/.test(src),
  "Gemini 3 thinking budget is no longer bounded — an open budget can consume the whole output allowance",
);
check(
  /finishReason !== "STOP"/.test(src),
  "finishReason is no longer checked — a truncated response will crash in JSON.parse instead of reporting MAX_TOKENS",
);
check(
  /\.filter\(\(p: \{ thought\?: boolean; text\?: string \}\) => !p\.thought/.test(src),
  "Gemini text extraction no longer skips thought parts / reads only parts[0]",
);
check(
  !/parsed = JSON\.parse\(jsonMatch\[0\]\);\n  \}/.test(src),
  "the fallback JSON.parse is unwrapped again — a raw V8 parse error will reach the operator",
);

// --- the corpus these rules exist for must still carry quarter-point rubrics ---
const quarterPoint = readdirSync(KEYS_DIR)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(join(KEYS_DIR, f), "utf8")).key)
  .filter((q) => /0\.25|0\.75/.test(q.scoring_notes ?? "")).length;

check(
  quarterPoint > 0,
  "no seed answer key specifies a quarter-point award step — the partial-credit rules have nothing to act on",
);

if (failures.length > 0) {
  console.error("Gnahatum prompt contract FAILED:\n");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`Gnahatum prompt contract OK — ${quarterPoint} questions award in quarter-point steps.`);
