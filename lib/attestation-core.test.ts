// Run: npm run test:unit
// Fixtures copy the LAYOUTS of the real attestation key PDFs (as pdf-parse emits them)
// with made-up answers — the real keys are test content and stay out of git.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gradeQuestion,
  gradeAttempt,
  numericEquals,
  parseKeyText,
  normalizeKeyCell,
  splitKeyCell,
  validateCorrect,
  sameCorrect,
  parseEmails,
  deadlineOf,
  deadlineForNewAttempt,
  isExpired,
  visibleTests,
  GRACE_SECONDS,
  type Choice,
} from "./attestation-core.ts";

const opts = (...ids: string[]): Choice[] => ids.map((id) => ({ id, text: `opt ${id}` }));
const nums = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

// --- grading -----------------------------------------------------------------

test("single: exact option only", () => {
  const q = { answer_type: "single" as const, correct: "3", points: 1, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, "3").earned, 1);
  assert.equal(gradeQuestion(q, "2").earned, 0);
  assert.equal(gradeQuestion(q, null).answered, false);
});

test("multi all-or-nothing ignores order, rejects extras", () => {
  const q = { answer_type: "multi" as const, correct: ["2", "5", "7"], points: 3, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, ["7", "2", "5"]).earned, 3);
  assert.equal(gradeQuestion(q, ["2", "5"]).earned, 0);
  assert.equal(gradeQuestion(q, ["2", "5", "7", "1"]).earned, 0);
});

test("multi partial: wrong picks cancel right ones, never negative", () => {
  const q = { answer_type: "multi" as const, correct: ["2", "5", "7"], points: 3, scoring: "partial" as const };
  assert.equal(gradeQuestion(q, ["2", "5"]).earned, 2);
  assert.equal(gradeQuestion(q, ["2", "5", "1"]).earned, 1);
  assert.equal(gradeQuestion(q, ["1", "2", "3", "4", "5", "6", "7"]).earned, 0);
});

test("order: full sequence, or positional credit when partial", () => {
  const strict = { answer_type: "order" as const, correct: ["3", "1", "2"], points: 1, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(strict, ["3", "1", "2"]).earned, 1);
  assert.equal(gradeQuestion(strict, ["3", "2", "1"]).earned, 0);
  const partial = { ...strict, scoring: "partial" as const, points: 3 };
  assert.equal(gradeQuestion(partial, ["3", "2", "1"]).earned, 1);
});

test("match: per-slot credit only when partial", () => {
  const correct = { A: "6", B: "2", C: "5" };
  const q = { answer_type: "match" as const, correct, points: 3, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, { A: "6", B: "2", C: "5" }).earned, 3);
  assert.equal(gradeQuestion(q, { A: "6", B: "2", C: "1" }).earned, 0);
  assert.equal(gradeQuestion({ ...q, scoring: "partial" }, { A: "6", B: "2", C: "1" }).earned, 2);
});

test("numeric tolerates decimal comma and spaces but not leading-zero base-n", () => {
  assert.ok(numericEquals("0,25", "0.25"));
  assert.ok(numericEquals("1 250", "1250"));
  assert.ok(numericEquals("16.0", "16"));
  assert.ok(numericEquals("0101", "0101"));
  assert.ok(!numericEquals("101", "0101"));
  assert.ok(!numericEquals("", "0"));
  const q = { answer_type: "numeric" as const, correct: ["240"], points: 1, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, " 240 ").earned, 1);
});

test("short_text is case- and space-insensitive", () => {
  const q = { answer_type: "short_text" as const, correct: ["Yerevan"], points: 1, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, "  yerevan ").earned, 1);
});

test("a question with no key earns nothing (never auto-correct)", () => {
  const q = { answer_type: "single" as const, correct: null, points: 1, scoring: "all_or_nothing" as const };
  assert.equal(gradeQuestion(q, "1").earned, 0);
});

test("gradeAttempt sums weighted points into a percentage", () => {
  const qs = [
    { id: "a", answer_type: "single" as const, correct: "1", points: 1, scoring: "all_or_nothing" as const },
    { id: "b", answer_type: "multi" as const, correct: ["1", "2", "3"], points: 3, scoring: "all_or_nothing" as const },
  ];
  const g = gradeAttempt(qs, { a: "1", b: ["1", "2"] });
  assert.equal(g.score, 1);
  assert.equal(g.maxScore, 4);
  assert.equal(g.percent, 25);
  assert.equal(gradeAttempt(qs, {}).percent, 0);
});

// --- key parsing: one layout per real key family ------------------------------

test("parses one-cell-per-line keys with a mojibake title and missing dots (math layout)", () => {
  const text = "\n\nØ³Ã»Ù³ïÇÏ³ \n \nՀ/հ \nԹեստ-1 \nՀ/հ \nԹեստ-1 \n1. \n2 \n4. \n120 \n2. \n3 \n5 \n9 \n3. \n1 \n6. \n77 \n";
  const k = parseKeyText(text, nums(1, 6));
  assert.deepEqual(k.raw, { "1": "2", "4": "120", "2": "3", "5": "9", "3": "1", "6": "77" });
  assert.deepEqual(k.missing, []);
});

test("parses two-column rows with sub-numbers and run-together multi answers (Armenian layout)", () => {
  const text = "N     Թեստ1  N Թեստ1 \n1 4  12.2 1346 \n2 3  12.3 46789 \n12.1 25678  13 136 \n";
  const k = parseKeyText(text, ["1", "2", "12.1", "12.2", "12.3", "13"]);
  assert.equal(k.raw["12.2"], "1346");
  assert.equal(k.raw["12.1"], "25678");
  assert.equal(k.raw["13"], "136");
  assert.deepEqual(k.missing, []);
});

test("parses comma lists and Armenian-letter sequences (history layout)", () => {
  const text = "N Թեստ 1  N Թեստ 1 \n1.  4  4. 2,4,7 \n2.  2  5. դ,գ,բ,ա \n3.  4    \n";
  const k = parseKeyText(text, nums(1, 5));
  assert.equal(k.raw["4"], "2,4,7");
  assert.equal(k.raw["5"], "դ,գ,բ,ա");
  assert.deepEqual(k.missing, []);
});

test("parses three columns where multi answers are space separated (elementary layout)", () => {
  // Columns hold disjoint number ranges (1–15 | 16–30 | 31–35), as in the real key.
  const text =
    "N Մայրենի  N   Մաթեմատիկա  N   Շրջակա աշխարհ \n1 3  16 2  31 2 \n2 2  4  17 1; 3    \n   21.1 20    \n";
  const k = parseKeyText(text, ["1", "2", "16", "17", "21.1", "31"]);
  assert.equal(k.raw["2"], "2 4");
  assert.equal(k.raw["17"], "1; 3");
  assert.equal(k.raw["21.1"], "20");
  assert.deepEqual(k.missing, []);
});

test("parses an answer wrapped onto the next line (physics layout)", () => {
  const text = "N Թեստ 1 N Թեստ 1 \n1. 3 3. 20 \n2. 3 4. \n10 \n";
  const k = parseKeyText(text, nums(1, 4));
  assert.equal(k.raw["4"], "10");
  assert.deepEqual(k.missing, []);
});

test("parses two-column rows the PDF glued together without spaces (chemistry/informatics/German layout)", () => {
  // Left column 1–4, right column 5–7; "2" + "4" + "6" + "1120"; a right answer spilling to its own line.
  const text = "\n\nNԹեստ 1NԹեստ 1\n1351\n2b6\n100\n3c71120\n4d\n     Քիմիա";
  const k = parseKeyText(text, nums(1, 7));
  assert.equal(k.strategy, "glued");
  assert.deepEqual(k.raw, { "1": "3", "5": "1", "2": "b", "6": "100", "3": "c", "7": "1120", "4": "d" });
  assert.deepEqual(k.missing, []);
});

test("reports questions the key does not cover instead of guessing", () => {
  const k = parseKeyText("1. 3 \n2. 4 \n", nums(1, 3));
  assert.deepEqual(k.missing, ["3"]);
});

// --- key normalisation ---------------------------------------------------------

test("splitKeyCell handles every separator style", () => {
  assert.deepEqual(splitKeyCell("257"), ["2", "5", "7"]);
  assert.deepEqual(splitKeyCell("2,5,7"), ["2", "5", "7"]);
  assert.deepEqual(splitKeyCell("3.4.6.7"), ["3", "4", "6", "7"]);
  assert.deepEqual(splitKeyCell("1; 3; 5"), ["1", "3", "5"]);
  assert.deepEqual(splitKeyCell("2 4"), ["2", "4"]);
});

test("normalizes letter keys for numbered options by alphabet position, with a warning", () => {
  const n = normalizeKeyCell("դ,գ,բ,ա", { answer_type: "order", options: opts("1", "2", "3", "4"), match_slots: [] });
  assert.deepEqual(n.correct, ["4", "3", "2", "1"]);
  assert.ok(n.warnings.length > 0);
});

test("normalizes letter-labelled single choice case-insensitively", () => {
  const n = normalizeKeyCell("B", { answer_type: "single", options: opts("a", "b", "c", "d"), match_slots: [] });
  assert.equal(n.correct, "b");
  assert.deepEqual(n.warnings, []);
});

test("match keys fill slots in order and warn on a count mismatch", () => {
  const q = { answer_type: "match" as const, options: opts("1", "2", "3", "4", "5", "6", "7"), match_slots: opts("A", "B", "C", "D", "E") };
  assert.deepEqual(normalizeKeyCell("62517", q).correct, { A: "6", B: "2", C: "5", D: "1", E: "7" });
  const short = normalizeKeyCell("1524", q);
  assert.ok(short.warnings.some((w) => w.includes("slot")));
});

test("numeric keys are kept verbatim as the accepted value", () => {
  assert.deepEqual(normalizeKeyCell("0101", { answer_type: "numeric", options: [], match_slots: [] }).correct, ["0101"]);
});

test("validateCorrect flags keys that point outside the options", () => {
  const q = { answer_type: "multi" as const, options: opts("1", "2", "3"), match_slots: [] };
  assert.deepEqual(validateCorrect({ ...q, correct: ["1", "3"] }), []);
  assert.ok(validateCorrect({ ...q, correct: ["1", "9"] }).length > 0);
  assert.ok(validateCorrect({ ...q, correct: null }).length > 0);
});

test("sameCorrect compares maps regardless of key order", () => {
  assert.ok(sameCorrect({ A: "1", B: "2" }, { B: "2", A: "1" }));
  assert.ok(!sameCorrect(["1", "2"], ["2", "1"]));
});

test("numericEquals rejects JS literals and second separators, accepts the Unicode minus", () => {
  assert.ok(!numericEquals("0b10000", "16"));
  assert.ok(!numericEquals("0x10", "16"));
  assert.ok(!numericEquals("1e3", "1000"));
  assert.ok(!numericEquals("1,2,5", "1.25"));
  assert.ok(numericEquals("−5", "-5"));
  assert.ok(numericEquals("0,25", "0.25"));
});

// --- test-taker invitations ------------------------------------------------------

test("parseEmails: lines, commas, semicolons and spaces; lower-cased, de-duplicated", () => {
  const r = parseEmails("A.Teacher@Example.org\nb@x.am, c@y.com;  a.teacher@example.org\t<d@z.org>");
  assert.deepEqual(r.emails, ["a.teacher@example.org", "b@x.am", "c@y.com", "d@z.org"]);
  assert.deepEqual(r.invalid, []);
});

test("parseEmails: reports what is not an address", () => {
  const r = parseEmails("Anna Asatryan, ok@x.am, broken@, @nope.com");
  assert.deepEqual(r.emails, ["ok@x.am"]);
  assert.deepEqual(r.invalid, ["Anna", "Asatryan", "broken@", "@nope.com"]);
  assert.deepEqual(parseEmails("  \n ,; ").emails, []);
});

test("an attempt's deadline is only what was stored at start (ADR-0011)", () => {
  // The test's limit is not an input at all: editing it cannot touch a live attempt.
  assert.equal(deadlineOf({ deadline_at: "2026-11-28T11:00:00.000Z" })?.toISOString(), "2026-11-28T11:00:00.000Z");
  // An attempt started while the test was untimed stays untimed after a limit is added.
  assert.equal(deadlineOf({ deadline_at: null }), null);
  assert.equal(deadlineOf({}), null);
});

test("a new attempt's deadline is start + limit, none when untimed", () => {
  const start = new Date("2026-11-28T10:00:00.000Z");
  assert.equal(deadlineForNewAttempt({ time_limit_minutes: 90 }, start)?.toISOString(), "2026-11-28T11:30:00.000Z");
  assert.equal(deadlineForNewAttempt({ time_limit_minutes: null }, start), null);
});

test("expiry allows the grace period, never expires an untimed attempt", () => {
  const d = new Date("2026-11-28T11:00:00.000Z");
  assert.equal(isExpired(d, d.getTime() + GRACE_SECONDS * 1000), false);
  assert.equal(isExpired(d, d.getTime() + GRACE_SECONDS * 1000 + 1), true);
  assert.equal(isExpired(null, Date.now() + 1e12), false);
});

test("teachers see only invited tests; managers see all", () => {
  const tests = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(visibleTests(tests, new Set(["b"])).map((t) => t.id), ["b"]);
  assert.deepEqual(visibleTests(tests, new Set()), []);
  assert.deepEqual(visibleTests(tests, null).map((t) => t.id), ["a", "b", "c"]);
});
