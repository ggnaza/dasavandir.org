// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { sortByCourseStatus, normalizeCourseStatus } from "./course-status.ts";

test("completed and archived courses sink, original order kept within groups", () => {
  const list = [
    { id: "a", status: "archived" },
    { id: "b", status: "active" },
    { id: "c", status: "completed" },
    { id: "d", status: null },
    { id: "e", status: "active" },
  ];
  assert.deepEqual(sortByCourseStatus(list).map((c) => c.id), ["b", "d", "e", "c", "a"]);
});

test("extraRank pushes a finished course below in-progress active ones, above completed", () => {
  const list = [
    { id: "done", status: "active", pct: 100 },
    { id: "comp", status: "completed", pct: 10 },
    { id: "wip", status: "active", pct: 40 },
  ];
  assert.deepEqual(sortByCourseStatus(list, (c) => (c.pct === 100 ? 1 : 0)).map((c) => c.id), ["wip", "done", "comp"]);
});

test("unknown values are treated as active", () => {
  assert.equal(normalizeCourseStatus("deleted"), "active");
  assert.equal(normalizeCourseStatus(undefined), "active");
  assert.equal(normalizeCourseStatus("archived"), "archived");
});
