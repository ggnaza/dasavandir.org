/**
 * Ripple a time change forward through back-to-back sessions.
 *
 * When a session's end time moves, any session that started exactly when it ended
 * is pushed by the same amount — and so is whatever followed that, for as long as
 * the chain holds. The chain stops at the first gap: a gap is slack the schedule
 * already carries, so it absorbs the change rather than propagating it.
 *
 * This matters because a real agenda is a chain, not a list of islands: TLA 2026 has
 * 233 contiguous adjacencies against 42 gaps, and a typical day is 7 sessions
 * back-to-back. Without the ripple, nudging the first session by 5 minutes means
 * hand-editing six more.
 *
 * All times are Armenia wall-clock "HH:MM" and stay that way — see the timezone
 * contract in parse-agenda-sheet.ts. Nothing here builds a Date.
 */

export type Slot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string | null;
};

export type Shift = { id: string; start_time: string; end_time: string | null };

const toMin = (t: string): number => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const toHHMM = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Contiguity is judged against the ORIGINAL schedule, so the whole chain is found. */
const contiguous = (prevEnd: string | null, nextStart: string): boolean =>
  prevEnd !== null && toMin(prevEnd) === toMin(nextStart);

/**
 * Sessions that must move after `changedId`'s end time becomes `newEnd`.
 *
 * Returns [] when nothing follows contiguously — the common case for an isolated
 * session, and for any session followed by a gap.
 *
 * Symmetric: shortening a session pulls the chain earlier by the same amount, which
 * is what keeps back-to-back sessions back-to-back.
 *
 * Returns [] rather than a partial chain if any shift would cross midnight — a
 * timetable entry is a wall-clock time on a given date and has nowhere to overflow
 * to, so silently wrapping to 00:05 would be worse than declining.
 */
export function cascadeAfterEndChange(
  all: Slot[],
  changedId: string,
  newEnd: string,
): Shift[] {
  const changed = all.find((s) => s.id === changedId);
  if (!changed || !changed.end_time) return [];

  const delta = toMin(newEnd) - toMin(changed.end_time);
  if (delta === 0) return [];

  const day = all
    .filter((s) => s.date === changed.date && s.id !== changedId)
    .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

  const shifts: Shift[] = [];
  let prevOriginalEnd: string | null = changed.end_time;

  for (const s of day) {
    if (toMin(s.start_time) < toMin(changed.start_time)) continue; // earlier in the day
    if (!contiguous(prevOriginalEnd, s.start_time)) break;          // gap absorbs it

    const start = toMin(s.start_time) + delta;
    const end = s.end_time === null ? null : toMin(s.end_time) + delta;

    if (start < 0 || start > 24 * 60 || (end !== null && (end < 0 || end > 24 * 60))) {
      return [];
    }

    shifts.push({ id: s.id, start_time: toHHMM(start), end_time: end === null ? null : toHHMM(end) });

    // Advance on the ORIGINAL end: contiguity describes the schedule as it was.
    prevOriginalEnd = s.end_time;
    if (prevOriginalEnd === null) break; // open-ended session — nothing to chain from
  }

  return shifts;
}
