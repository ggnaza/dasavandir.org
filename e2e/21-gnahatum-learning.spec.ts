import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { formatLearnedKnowledge, normalizeVariant, EMPTY_KNOWLEDGE } from "../lib/gnahatum/learning";
import { POINT_DISTRIBUTION } from "../lib/gnahatum/constants";
import type { AnswerKeyItem } from "../lib/gnahatum/constants";

/**
 * The learning layer exists so that what teachers teach the scorer survives a
 * model change. These tests pin the two things that make that true: the
 * knowledge is rendered into the prompt as plain text, and nothing about it is
 * keyed on a model.
 */

const key: AnswerKeyItem[] = [
  { number: 1, points: 0.5, type: "multiple_choice", answer: "բ. ալյումինե գդալ" },
  {
    number: 2,
    points: 0.5,
    type: "fill_blank",
    answer: "Պարզ նյութ",
    accepted_variants: ["պարզ նյութեր"],
  },
];

test("renders nothing when there is nothing learned", () => {
  expect(formatLearnedKnowledge(EMPTY_KNOWLEDGE, [])).toBe("");
});

test("hand-authored accepted_variants from the answer key reach the prompt", () => {
  const block = formatLearnedKnowledge(EMPTY_KNOWLEDGE, key);
  expect(block).toContain("Q2:");
  expect(block).toContain("պարզ նյութեր");
});

test("teacher verdicts are rendered as accepted and rejected, per question", () => {
  const block = formatLearnedKnowledge(
    {
      variants: [
        {
          question_number: 1,
          variant_text: "ալյումինից գդալ",
          verdict: "accept",
          points_awarded: 0.5,
          times_seen: 3,
        },
        {
          question_number: 1,
          variant_text: "կավիճ",
          verdict: "reject",
          points_awarded: 0,
          times_seen: 1,
        },
      ],
      precedents: [
        { question_number: 1, rule_text: "Ուղղագրական սխալի դեպքում միավոր չհանել", evidence_count: 4 },
      ],
    },
    key,
  );

  expect(block).toContain("ալյումինից գդալ");
  expect(block).toContain("seen 3x");
  expect(block).toContain("ACCEPTED");
  expect(block).toContain("կավիճ");
  expect(block).toContain("REJECTED");
  expect(block).toContain("Ուղղագրական սխալի դեպքում միավոր չհանել");
});

test("variant normalisation collapses case and whitespace so duplicates dedupe", () => {
  expect(normalizeVariant("  Պարզ   ՆՅՈՒԹ ")).toBe(normalizeVariant("պարզ նյութ"));
});

/**
 * The invariant the whole design rests on. If a model column ever appears on
 * the knowledge tables, switching models starts losing what was learned —
 * which is exactly what this layer was built to prevent.
 */
test("the knowledge tables are not keyed on a model", () => {
  const sql = readFileSync(
    join(__dirname, "..", "supabase", "migrations", "gnahatum_learning_layer.sql"),
    "utf8",
  );

  const knowledgeTables = ["answer_variants", "scoring_precedents"];
  for (const table of knowledgeTables) {
    const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ararka.${table}`);
    expect(start, `${table} is missing from the migration`).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf(");", start));
    expect(
      body,
      `${table} must not carry a model column — knowledge has to outlive a model swap`,
    ).not.toMatch(/model/i);
  }

  // benchmark_runs is the one place a model id belongs.
  expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ararka\.benchmark_runs[\s\S]*?model_id\s+text NOT NULL/);
});

/**
 * PostgREST exposes the `ararka` schema and the schema grants give
 * `authenticated` full table access, so RLS is the only thing standing between
 * a signed-in learner and every student's scanned answers. New tables default
 * to RLS off — this catches a table added without it.
 */
test("every new table holding student data has row-level security enabled", () => {
  const sql = readFileSync(
    join(__dirname, "..", "supabase", "migrations", "gnahatum_learning_layer.sql"),
    "utf8",
  );

  const created = Array.from(
    sql.matchAll(/CREATE TABLE IF NOT EXISTS ararka\.(\w+)/g),
    (m) => m[1],
  );
  expect(created.length, "no tables found in the migration").toBeGreaterThan(0);

  for (const table of created) {
    expect(
      sql,
      `ararka.${table} is created but never has RLS enabled — it would be readable by any signed-in user`,
    ).toContain(`ALTER TABLE ararka.${table}`);
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE ararka\\.${table}\\s+ENABLE ROW LEVEL SECURITY`),
    );
  }
});

/**
 * A wrong answer key silently mis-grades real students, so the committed seed
 * data is checked here as well as in the generator.
 */
test("every committed answer key has 15 questions worth exactly 15 points", () => {
  const dir = join(__dirname, "..", "supabase", "seed-data", "gnahatum-keys");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  expect(files.length, "no seed keys found").toBeGreaterThan(0);

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      key: AnswerKeyItem[];
    };

    expect(data.key.length, `${file}: expected 15 questions`).toBe(15);

    let total = 0;
    for (const item of data.key) {
      expect(
        item.points,
        `${file}: Q${item.number} does not match the fixed point distribution`,
      ).toBeCloseTo(POINT_DISTRIBUTION[item.number], 5);
      expect(String(item.answer).trim(), `${file}: Q${item.number} has an empty answer`).not.toBe("");
      total += item.points;
    }
    expect(total, `${file}: total must be 15`).toBeCloseTo(15, 5);

    const numbers = data.key.map((i) => i.number);
    expect(new Set(numbers).size, `${file}: duplicate question numbers`).toBe(15);
  }
});
