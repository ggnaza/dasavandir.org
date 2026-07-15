import { test, expect } from "@playwright/test";
import { mondayOf, weeksOf, defaultWeek, weekLabel, addDays } from "../lib/timetable/weeks";

/** Pure logic — no browser, no database. These actually run. */

// The real TLA 2026 span: 2026-06-29 → 2026-08-01.
const TLA_WEEKS = ["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"];

test("mondayOf snaps any day to its Monday", () => {
  expect(mondayOf("2026-06-29")).toBe("2026-06-29"); // a Monday
  expect(mondayOf("2026-07-02")).toBe("2026-06-29"); // Thursday
  expect(mondayOf("2026-07-05")).toBe("2026-06-29"); // Sunday — same week, not the next
});

test("Sunday belongs to the week that just ended, not the one starting", () => {
  // The classic off-by-one: getUTCDay() is 0 for Sunday, so a naive `dow - 1`
  // would jump Sunday forward a week instead of back six days.
  expect(mondayOf("2026-07-19")).toBe("2026-07-13");
  expect(mondayOf("2026-07-20")).toBe("2026-07-20");
});

test("the real course span buckets into five weeks", () => {
  const dates: string[] = [];
  for (let d = "2026-06-29"; d <= "2026-08-01"; d = addDays(d, 1)) dates.push(d);
  expect(weeksOf(dates)).toEqual(TLA_WEEKS);
});

test("opens on the week containing today, while the course is running", () => {
  expect(defaultWeek(TLA_WEEKS, "2026-07-16")).toBe("2026-07-13");
  expect(defaultWeek(TLA_WEEKS, "2026-06-29")).toBe("2026-06-29");
  expect(defaultWeek(TLA_WEEKS, "2026-08-01")).toBe("2026-07-27");
});

test("a finished course opens on its last week, not a blank tab", () => {
  expect(defaultWeek(TLA_WEEKS, "2026-12-25")).toBe("2026-07-27");
});

test("an unstarted course opens on its first week", () => {
  expect(defaultWeek(TLA_WEEKS, "2026-01-05")).toBe("2026-06-29");
});

test("no entries means no tab to open", () => {
  expect(defaultWeek([], "2026-07-16")).toBeNull();
});

test("labels stay readable across a month boundary", () => {
  expect(weekLabel("2026-06-29")).toBe("29 Jun – 5 Jul");
  expect(weekLabel("2026-07-13")).toBe("13 Jul – 19 Jul");
  expect(weekLabel("2026-07-27")).toBe("27 Jul – 2 Aug");
});

test("date maths does not drift across a DST boundary", () => {
  // Europe changed clocks on 2026-03-29. These are calendar days in a fixed UTC
  // frame, so a Monday must still resolve to a Monday either side of it.
  expect(mondayOf("2026-03-28")).toBe("2026-03-23");
  expect(mondayOf("2026-03-30")).toBe("2026-03-30");
  expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
});
