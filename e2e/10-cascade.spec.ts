import { test, expect } from "@playwright/test";
import { cascadeAfterEndChange, type Slot } from "../lib/timetable/cascade";

/**
 * Pure logic — no browser, no database, no credentials. These actually run.
 *
 * The shape under test is taken from a real TLA 2026 day (2026-07-16), which is
 * seven back-to-back sessions. Getting the chain wrong there would silently rewrite
 * a whole day of a live course.
 */

const day = (rows: [string, string, string | null][]): Slot[] =>
  rows.map(([id, start, end]) => ({ id, date: "2026-07-16", start_time: start, end_time: end }));

// The real 2026-07-16 agenda: one unbroken chain.
const REAL_DAY = day([
  ["a", "09:00", "11:30"],
  ["b", "11:30", "12:30"],
  ["c", "12:30", "14:00"],
  ["d", "14:00", "15:00"],
  ["e", "15:00", "16:30"],
  ["f", "16:30", "17:00"],
  ["g", "17:00", "18:00"],
]);

test("the operator's example: +5 min pushes the next session by 5", () => {
  const slots = day([["one", "09:00", "09:30"], ["two", "09:30", "10:00"]]);
  expect(cascadeAfterEndChange(slots, "one", "09:35")).toEqual([
    { id: "two", start_time: "09:35", end_time: "10:05" },
  ]);
});

test("a gap absorbs the change — nothing moves", () => {
  const slots = day([["one", "09:00", "09:30"], ["two", "09:45", "10:00"]]);
  expect(cascadeAfterEndChange(slots, "one", "09:35")).toEqual([]);
});

test("the whole contiguous chain ripples, not just the next one", () => {
  const shifts = cascadeAfterEndChange(REAL_DAY, "a", "11:35");
  expect(shifts.map((s) => s.id)).toEqual(["b", "c", "d", "e", "f", "g"]);
  expect(shifts[0]).toEqual({ id: "b", start_time: "11:35", end_time: "12:35" });
  expect(shifts[5]).toEqual({ id: "g", start_time: "17:05", end_time: "18:05" });
});

test("the chain stops at the first gap and leaves the rest alone", () => {
  const slots = day([
    ["a", "09:00", "09:30"],
    ["b", "09:30", "10:00"], // contiguous — moves
    ["c", "10:15", "11:00"], // gap before it — stops here
    ["d", "11:00", "12:00"], // contiguous with c, but c never moved
  ]);
  expect(cascadeAfterEndChange(slots, "a", "09:35").map((s) => s.id)).toEqual(["b"]);
});

test("durations are preserved, not stretched", () => {
  const shifts = cascadeAfterEndChange(REAL_DAY, "a", "11:35");
  const c = shifts.find((s) => s.id === "c")!;
  // c was 12:30–14:00, ninety minutes; it must still be ninety.
  expect(c.start_time).toBe("12:35");
  expect(c.end_time).toBe("14:05");
});

test("shortening a session pulls the chain earlier — symmetric", () => {
  const slots = day([["one", "09:00", "09:30"], ["two", "09:30", "10:00"]]);
  expect(cascadeAfterEndChange(slots, "one", "09:25")).toEqual([
    { id: "two", start_time: "09:25", end_time: "09:55" },
  ]);
});

test("no change means no ripple", () => {
  expect(cascadeAfterEndChange(REAL_DAY, "a", "11:30")).toEqual([]);
});

test("the last session of the day ripples nothing", () => {
  expect(cascadeAfterEndChange(REAL_DAY, "g", "18:30")).toEqual([]);
});

test("only the same day is touched", () => {
  const slots: Slot[] = [
    { id: "a", date: "2026-07-16", start_time: "09:00", end_time: "09:30" },
    { id: "x", date: "2026-07-17", start_time: "09:30", end_time: "10:00" },
  ];
  expect(cascadeAfterEndChange(slots, "a", "09:35")).toEqual([]);
});

test("a session earlier in the day is never dragged forward", () => {
  const slots = day([["early", "08:00", "09:00"], ["a", "09:00", "09:30"], ["b", "09:30", "10:00"]]);
  const shifts = cascadeAfterEndChange(slots, "a", "09:35");
  expect(shifts.map((s) => s.id)).toEqual(["b"]);
});

test("an open-ended session ends the chain", () => {
  const slots = day([["a", "09:00", "09:30"], ["b", "09:30", null], ["c", "10:00", "11:00"]]);
  const shifts = cascadeAfterEndChange(slots, "a", "09:35");
  expect(shifts).toEqual([{ id: "b", start_time: "09:35", end_time: null }]);
});

test("a shift past midnight is declined outright, not wrapped", () => {
  const slots = day([["a", "22:00", "23:00"], ["b", "23:00", "23:30"]]);
  // b would land at 01:00–01:30 the "next day", which a date-bound row cannot express.
  expect(cascadeAfterEndChange(slots, "a", "25:00" as string)).toEqual([]);
});

test("an unknown id, or a session with no end time, ripples nothing", () => {
  expect(cascadeAfterEndChange(REAL_DAY, "nope", "10:00")).toEqual([]);
  const openEnded = day([["a", "09:00", null], ["b", "09:30", "10:00"]]);
  expect(cascadeAfterEndChange(openEnded, "a", "09:35")).toEqual([]);
});
