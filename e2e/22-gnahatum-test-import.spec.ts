import { test, expect } from "@playwright/test";
import {
  normaliseImportedKey,
  validateKeyForSave,
  parseModelJson,
  driveFileIdFromUrl,
} from "../lib/gnahatum/import";
import { POINT_DISTRIBUTION } from "../lib/gnahatum/constants";
import type { AnswerKeyItem } from "../lib/gnahatum/constants";

/**
 * The importer turns a document into the grading standard for real student
 * papers, so the rules it enforces are the point of it: never trust the model
 * for points, never save a key with a hole in it, and never silently drop a
 * question.
 */

function modelOutput(items: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  return { items, warnings: [], suggested: {}, ...extra };
}

const fullKey = Array.from({ length: 15 }, (_, i) => ({
  number: i + 1,
  type: "short_answer",
  answer: `answer ${i + 1}`,
}));

test("points come from the fixed distribution, never from the model", () => {
  const raw = modelOutput(
    fullKey.map((i) => ({ ...i, points: 99 })), // model tries to set its own points
  );
  const { items } = normaliseImportedKey(raw);

  for (const item of items) {
    expect(item.points, `Q${item.number}`).toBe(POINT_DISTRIBUTION[item.number]);
  }
  expect(items.reduce((s, i) => s + i.points, 0)).toBeCloseTo(15, 5);
});

test("a missing question is emitted blank with a warning, not skipped or invented", () => {
  const raw = modelOutput(fullKey.filter((i) => i.number !== 7));
  const { items, warnings } = normaliseImportedKey(raw);

  expect(items).toHaveLength(15);
  const q7 = items.find((i) => i.number === 7)!;
  expect(q7.answer).toBe("");
  expect(warnings.join(" ")).toContain("Q7");
});

test("a duplicated question keeps the first answer and warns", () => {
  const raw = modelOutput([
    ...fullKey,
    { number: 3, type: "short_answer", answer: "a different answer" },
  ]);
  const { items, warnings } = normaliseImportedKey(raw);

  expect(items.find((i) => i.number === 3)!.answer).toBe("answer 3");
  expect(warnings.join(" ")).toContain("Q3");
});

test("an unknown question type falls back rather than reaching the database", () => {
  const raw = modelOutput(fullKey.map((i) => ({ ...i, type: "freeform_nonsense" })));
  const { items } = normaliseImportedKey(raw);
  expect(items.every((i) => i.type === "short_answer")).toBe(true);
});

test("out-of-range question numbers are discarded", () => {
  const raw = modelOutput([...fullKey, { number: 42, type: "essay", answer: "x" }]);
  const { items } = normaliseImportedKey(raw);
  expect(items).toHaveLength(15);
  expect(items.some((i) => i.number === 42)).toBe(false);
});

test("save is refused while any answer is blank", () => {
  const items = normaliseImportedKey(modelOutput(fullKey.filter((i) => i.number !== 4))).items;
  const errors = validateKeyForSave(items);
  expect(errors.join(" ")).toContain("Q4");
});

test("a complete key passes validation", () => {
  const items = normaliseImportedKey(modelOutput(fullKey)).items;
  expect(validateKeyForSave(items)).toEqual([]);
});

test("validation catches a tampered point value", () => {
  const items = normaliseImportedKey(modelOutput(fullKey)).items;
  const tampered: AnswerKeyItem[] = items.map((i) =>
    i.number === 1 ? { ...i, points: 5 } : i,
  );
  const errors = validateKeyForSave(tampered);
  expect(errors.join(" ")).toContain("Q1");
  expect(errors.join(" ")).toContain("expected 15");
});

test("model JSON is recovered from a fenced or chatty response", () => {
  const parsed = parseModelJson('Sure! ```json\n{"items":[],"warnings":["w"]}\n``` hope that helps');
  expect((parsed as { warnings: string[] }).warnings).toEqual(["w"]);
});

test("drive ids are pulled out of the shapes people actually paste", () => {
  expect(driveFileIdFromUrl("https://docs.google.com/document/d/1ZLp243ot5kw7qhnmPcirvg776ghhEjve/edit?tab=t.0"))
    .toBe("1ZLp243ot5kw7qhnmPcirvg776ghhEjve");
  expect(driveFileIdFromUrl("https://drive.google.com/open?id=1ZLp243ot5kw7qhnmPcirvg776ghhEjve"))
    .toBe("1ZLp243ot5kw7qhnmPcirvg776ghhEjve");
  expect(driveFileIdFromUrl("1ZLp243ot5kw7qhnmPcirvg776ghhEjve"))
    .toBe("1ZLp243ot5kw7qhnmPcirvg776ghhEjve");
  expect(driveFileIdFromUrl("not a link")).toBeNull();
});
