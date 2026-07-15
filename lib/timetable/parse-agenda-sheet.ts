/**
 * Parser for the weekly agenda spreadsheet (xlsx export of the Google Sheet).
 *
 * Layout, verified against the real TLA 2026 workbook (5 tabs, 340 entries):
 *  - one tab per week; the tab name is not parsed (dates are authoritative)
 *  - row 4 holds the dates, on every tab
 *  - day columns step by 3 (C, F, I, L, O, R, U); the time column is always the
 *    one immediately to the left (B, E, H, K, N, Q, T)
 *  - rows 5+ are slots: "HH:MM-HH:MM" in the time column, the agenda text beside it
 *  - merged cells span multi-row blocks; only the merge anchor is emitted, or the
 *    same slot is counted once per covered row
 *
 * Real-world hazards this handles, each observed in the live workbook:
 *  - stale columns from previous cohorts (2023 and 2024 dates sitting past the real
 *    week on three tabs) — callers filter by expected year
 *  - separator cells ("—", "_______") that are not sessions
 *  - assignment footer rows with no time, which are not slots
 */

export type ParsedEntry = {
  /** Stable identity for idempotent re-import: sheet + cell of the agenda text. */
  sourceKey: string;
  sheet: string;
  /** Calendar day exactly as written in the sheet. Not an instant. */
  date: string;      // YYYY-MM-DD
  /**
   * Wall-clock time exactly as written in the sheet — which is ARMENIA time
   * (UTC+4). Carried through verbatim; see the timezone contract below.
   */
  startTime: string; // HH:MM
  endTime: string | null;
  title: string;
};

/**
 * TIMEZONE CONTRACT — times are Armenia wall-clock, start to finish. Do NOT convert.
 *
 * The sheet is authored in Armenia time (UTC+4). `timetable_entries.start_time` is a
 * Postgres `time` — no timezone — and every consumer renders it as a raw
 * `start_time.slice(0, 5)`: the learner timetable, the daily cron's email, and the
 * attendance tracker. Nothing in the codebase parses a timetable time into a Date.
 *
 * So the whole chain is timezone-naive by design, and a sheet "09:00" stored as
 * "09:00" displays to a learner as "09:00" — correct, with zero conversion.
 *
 * Converting to UTC on import (the instinctive "correct" move) would render every
 * session four hours early. If a timezone-aware model is ever wanted, it has to
 * change the column type, all three renderers, and the cron's day boundary together
 * — not just this parser.
 *
 * The day boundary is already handled the same way: the cron and the learner page
 * both do `Date.now() + 4h` then take the UTC date, which is Armenia's calendar day.
 * Armenia has not observed DST since 2012, so UTC+4 is year-round with no drift.
 *
 * Note the one place a timezone DOES bite: reading date CELLS. See toISODate below.
 */

export type ParseResult = {
  entries: ParsedEntry[];
  skipped: { reason: string; detail: string }[];
};

const TIME_RE = /^\s*(\d{1,2})[:.](\d{2})\s*[-–—:]\s*(\d{1,2})[:.](\d{2})/;
const NOT_A_SESSION = new Set(["—", "-", "–", "_______", "_____", "__"]);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * A cell value that xlsx gives as a Date (cellDates: true), or an ISO-ish string.
 *
 * LOCAL getters, deliberately — do NOT "fix" these to getUTC*().
 *
 * xlsx builds a date cell as LOCAL midnight of the day written in the sheet. On any
 * machine east of UTC that instant is the previous day in UTC, so UTC getters shift
 * every session one day earlier: cell "29 Jun 2026" on a UTC+2 host is
 * 2026-06-28T22:00:00Z, and getUTCDate() reports 28. A spreadsheet date carries no
 * timezone — it is a calendar day — so it must be read back in the same frame it
 * was constructed in. Verified on a CEST host: local getters recover 2026-06-29,
 * matching XLSX.SSF.parse_date_code on the raw serial (46202), which is
 * timezone-independent.
 */
function toISODate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/**
 * A minimal grid view: `cell(row, col)` is 1-indexed and must already resolve
 * merged ranges to their ANCHOR only (non-anchor cells return undefined), which is
 * what stops a merged multi-row block being emitted once per row it covers.
 */
export type Grid = {
  name: string;
  maxRow: number;
  maxCol: number;
  cell: (row: number, col: number) => unknown;
};

export function parseSheet(grid: Grid, opts: { expectYear?: number } = {}): ParseResult {
  const entries: ParsedEntry[] = [];
  const skipped: ParseResult["skipped"] = [];

  // Locate the date row. It is row 4 in every observed tab, but scan the top rows
  // rather than hard-coding it, so a shifted header does not silently yield zero.
  let dateRow = -1;
  let dayCols: { col: number; date: string }[] = [];
  for (let r = 1; r <= Math.min(8, grid.maxRow); r++) {
    const hits: { col: number; date: string }[] = [];
    for (let c = 1; c <= grid.maxCol; c++) {
      const d = toISODate(grid.cell(r, c));
      if (d) hits.push({ col: c, date: d });
    }
    if (hits.length >= 3) {
      dateRow = r;
      dayCols = hits;
      break;
    }
  }
  if (dateRow === -1) {
    skipped.push({ reason: "no date row found", detail: grid.name });
    return { entries, skipped };
  }

  for (const { col, date } of dayCols) {
    if (opts.expectYear && Number(date.slice(0, 4)) !== opts.expectYear) {
      // Leftovers from an earlier cohort. Importing them would create sessions
      // years in the past.
      skipped.push({ reason: "stale date", detail: `${date} in ${grid.name}` });
      continue;
    }

    for (let r = dateRow + 1; r <= grid.maxRow; r++) {
      const rawTitle = grid.cell(r, col);
      if (typeof rawTitle !== "string" || !rawTitle.trim()) continue;

      const title = rawTitle.replace(/\s+/g, " ").trim();
      if (NOT_A_SESSION.has(title)) continue;

      const rawTime = grid.cell(r, col - 1);
      const m = typeof rawTime === "string" ? rawTime.match(TIME_RE) : null;
      if (!m) {
        // Assignment footers and headings live in the agenda column but carry no
        // time. They are not slots.
        skipped.push({ reason: "no time alongside", detail: `${grid.name} r${r}: ${title.slice(0, 40)}` });
        continue;
      }

      const startTime = `${pad(Number(m[1]))}:${m[2]}`;
      const endTime = `${pad(Number(m[3]))}:${m[4]}`;

      entries.push({
        // Cell-anchored, so re-importing after an edit updates in place rather
        // than orphaning any moderator override attached to the old row.
        sourceKey: `sheet:${grid.name}:r${r}c${col}`,
        sheet: grid.name,
        date,
        startTime,
        endTime: endTime === startTime ? null : endTime,
        title,
      });
    }
  }

  return { entries, skipped };
}
