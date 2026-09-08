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
  /key\.points \?\? POINT_DISTRIBUTION/.test(src),
  "max_points no longer prefers the answer key over POINT_DISTRIBUTION — questions past Q15 will clamp to 0",
);

// --- Gemini must get guaranteed JSON, and Gemini 3 must get full-resolution scans ---
check(
  /responseMimeType: "application\/json"/.test(src) && /responseSchema: schema,/.test(src),
  "Gemini structured output was removed — the response falls back to fragile regex extraction",
);
check(
  /media_resolution = "MEDIA_RESOLUTION_HIGH"/.test(src),
  "Gemini 3 scans are no longer requested at high media resolution",
);

// --- the truncation guards must stay ---
check(
  /maxOutputTokens: 32768,/.test(src),
  "output budget dropped below 32768 — thinking tokens share it; a 16384 grading cap coincided with every grading call returning 400",
);
check(
  /generationConfig: \{ \.\.\.generationConfig, responseSchema: "<schema omitted>" \}/.test(src),
  "a Gemini 4xx no longer echoes the generationConfig it sent — the next INVALID_ARGUMENT will be a guess again",
);
// Gemini 3 is steered with thinkingLevel. A thinkingBudget sent to a Gemini 3
// model was silently ignored, thinking ran to ~30k tokens and the JSON arrived
// truncated (MAX_TOKENS) or not at all. The 2.5 legacy branch keeps its budget.
const gemini3Branch = src.slice(src.indexOf("if (model.highResolutionScans) {"), src.indexOf("} else if (model.model.includes(\"flash\"))"));
check(
  /thinkingConfig = \{ thinkingLevel: level \}/.test(gemini3Branch),
  "Gemini 3 no longer sets thinkingConfig.thinkingLevel — thinking will run unbounded at the default level",
);
check(
  // Code, not comments: the branch's own comment explains why a budget is wrong here.
  !/thinkingBudget\s*:/.test(gemini3Branch),
  "a thinkingBudget is being sent to Gemini 3 again — the docs say it may misbehave, and in production it was ignored",
);
check(
  /const exhausted = \(r: typeof result\) => r\.finishReason === "MAX_TOKENS" \|\| !r\.text;/.test(src),
  "the one-shot retry was removed — intermittent MAX_TOKENS / empty responses will fail the scan outright",
);
// A runaway ANSWER (thoughts ~0, answer at the cap) is a repetition loop, not
// thinking; only a higher temperature breaks it. The retry must change both.
// A string field can loop; a number cannot. The grading retry must drop the
// free-text fields — in production the loop recurred at thinking=low and
// temperature 0.6 with the full schema.
check(
  /await attempt\("low", 0\.6, call\.fallback\.schema, call\.prompt \+ call\.fallback\.promptSuffix, "minimal schema"\)/.test(src),
  "the grading retry no longer switches to the numbers-only fallback schema — a points_breakdown loop will recur on retry",
);
check(
  /fallback: \{ schema: GRADING_SCHEMA_MINIMAL, promptSuffix: GRADING_FALLBACK_SUFFIX \}/.test(src),
  "the grading call no longer declares its fallback",
);
check(
  !/GRADING_SCHEMA_MINIMAL = \{[\s\S]*?type: "STRING"[\s\S]*?\} as const;/.test(src.slice(src.indexOf("const GRADING_SCHEMA_MINIMAL"), src.indexOf("const GRADING_FALLBACK_SUFFIX"))),
  "GRADING_SCHEMA_MINIMAL contains a STRING field — the fallback exists precisely because strings loop",
);
check(
  /KEEP EVERY TEXT FIELD SHORT/.test(src),
  "the grading prompt no longer bounds points_breakdown/explanation length",
);
check(
  /Output ended: \$\{JSON\.stringify\(result\.text\.slice\(-300\)\)\}/.test(src),
  "a MAX_TOKENS error no longer carries the output tail — what the model got stuck on is lost again",
);
check(
  !/maxItems/.test(src),
  "maxItems is back in a response schema — it was added in #345 and removed with the grading 400; re-add only with a live-verified request",
);
check(
  /pass: "transcription",/.test(src) && /pass: "grading",/.test(src) && /\$\{call\.pass\} pass/.test(src),
  "model-call errors no longer name the pass — a failure will not say whether transcription or grading broke",
);
check(
  /finishReason !== "STOP"/.test(src),
  "finishReason is no longer checked — a truncated response will crash in JSON.parse instead of reporting MAX_TOKENS",
);
check(
  /allParts\s*\.filter\(\(p\) => !p\.thought/.test(src) && !/parts\?\.\[0\]\?\.text/.test(src),
  "Gemini text extraction no longer skips thought parts / reads only parts[0]",
);
check(
  !/parsed = JSON\.parse\(jsonMatch\[0\]\);\n  \}/.test(src),
  "the fallback JSON.parse is unwrapped again — a raw V8 parse error will reach the operator",
);

// --- the paper may already be graded; the model must not copy the marks ---
check(
  /THE PAPER MAY ALREADY BE MARKED BY A TEACHER\. THAT WRITING IS NOT THE STUDENT'S\./.test(src),
  "transcription prompt no longer carries the teacher-mark prohibition — the model copied teacher scores in production",
);
check(
  /Do NOT mention teacher marks anywhere in your output/.test(src),
  "transcription prompt no longer forbids mentioning teacher marks — that ban is what makes leakage detectable",
);

// --- ADR-0008: the grading pass must never receive the image ---
// The whole point of two passes is that the grader CANNOT see a teacher's
// mark. A `scan:` in the grading call would silently reopen the leak.
const gradingStart = src.indexOf("prompt: buildGradingPrompt(");
const gradingEnd = gradingStart === -1 ? -1 : src.indexOf("model,", gradingStart);
const gradingCall = gradingStart === -1 || gradingEnd === -1 ? null : src.slice(gradingStart, gradingEnd);
check(
  gradingCall !== null && !/\bscan:/.test(gradingCall),
  "the grading pass is being handed the scan — the grader must grade from the transcript only (ADR-0008)",
);
check(
  /prompt: buildTranscriptionPrompt\(answerKey\)/.test(src) && /scan: \{ base64: imageBase64/.test(src),
  "the transcription pass no longer receives the scan",
);
check(
  /const structure = answerKey/.test(src) && !/buildTranscriptionPrompt[\s\S]{0,1200}q\.answer\b/.test(src),
  "the transcription prompt is leaking the correct answers — reading must not be biased toward the key",
);
check(
  /citesTeacherMark/.test(src) && /contradictsOwnMath/.test(src),
  "server-side detection of teacher-mark leakage / self-contradictory awards was removed",
);
check(
  /SHOW THE ARITHMETIC, THEN MATCH IT/.test(src),
  "prompt no longer requires awarded_points to equal the stated arithmetic",
);
check(
  /ONE correct pair out of four still earns 0\.25/.test(src),
  "prompt no longer spells out the one-of-four matching case, where the zeros cluster",
);

// --- scores are displayed exactly; a corrected 2.75 once rendered as "2.8" ---
// Percentages and file sizes may round; a point value may not. Any .toFixed(1)
// on a gnahatum surface that is not a pct/MB is a score being rounded on screen.
import { readdirSync as _rd, statSync } from "node:fs";
const walk = (dir) => _rd(dir).flatMap((f) => {
  const full = join(dir, f);
  return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(f) ? [full] : [];
});
const roundedScores = ["components/gnahatum", "app/gnahatum"].flatMap(walk).flatMap((file) =>
  readFileSync(file, "utf8").split("\n")
    .map((line, i) => ({ file, line: i + 1, text: line }))
    .filter(({ text }) => /\.toFixed\(1\)/.test(text) && !/pct|MB|1024|confidence/.test(text)),
);
check(
  roundedScores.length === 0,
  `a score is rounded on screen with .toFixed(1) — use formatPoints(): ${roundedScores.map((r) => `${r.file}:${r.line}`).join(", ")}`,
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
