/**
 * Week bucketing for the creator's timetable view.
 *
 * Weeks run Monday–Sunday, matching the source spreadsheet (its day columns start
 * Երկուշաբթի / Monday) and the ISO convention.
 *
 * Dates here are calendar days ("YYYY-MM-DD"), never instants. Every helper works
 * in UTC purely as a fixed frame for date arithmetic — it is NOT a timezone claim.
 * Reading these back with local getters, or building them from Date.now(), would
 * reintroduce the off-by-one-day bug the sheet parser already had (see the timezone
 * contract in parse-agenda-sheet.ts).
 */

const DAY_MS = 86_400_000;

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
  const d = parse(date);
  const dow = d.getUTCDay(); // 0 = Sunday
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return fmt(new Date(d.getTime() - backToMonday * DAY_MS));
}

export function addDays(date: string, n: number): string {
  return fmt(new Date(parse(date).getTime() + n * DAY_MS));
}

/** Every distinct week (as its Monday) covered by these dates, chronological. */
export function weeksOf(dates: string[]): string[] {
  // Array.from rather than [...set]: the project's tsconfig target predates
  // downlevelIteration, so spreading a Set fails to compile here.
  return Array.from(new Set(dates.map(mondayOf))).sort();
}

/**
 * Which week tab to open on.
 *
 * The week containing today when the course is running — the overwhelmingly common
 * case, and the whole point of opening on "now". Otherwise the nearest week, so a
 * finished course opens on its last week and an unstarted one on its first, rather
 * than on a blank tab or an arbitrary end of the list.
 */
export function defaultWeek(weeks: string[], today: string): string | null {
  if (weeks.length === 0) return null;
  const thisWeek = mondayOf(today);
  if (weeks.includes(thisWeek)) return thisWeek;

  let best = weeks[0]!;
  let bestGap = Infinity;
  for (const w of weeks) {
    const gap = Math.abs(parse(w).getTime() - parse(thisWeek).getTime());
    if (gap < bestGap) { bestGap = gap; best = w; }
  }
  return best;
}

/** "29 Jun – 5 Jul" — compact, and unambiguous across a month boundary. */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const d = (s: string) =>
    parse(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${d(monday)} – ${d(sunday)}`;
}
