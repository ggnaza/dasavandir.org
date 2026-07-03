// Shared limits for lesson time-on-task tracking (`lesson_sessions.duration_seconds`).
//
// Time is recorded as short active-only chunks by the client SessionTracker, but
// historical rows (pre-2026-07) were open-to-close wall-clock spans that counted
// idle tabs and multiplied across multiple open tabs. To keep analytics sane we
// clamp any single session row to a realistic ceiling on read — no single
// continuous lesson sitting exceeds an hour of genuine active time, and the new
// tracker never emits a row larger than this anyway.

export const MAX_SESSION_ROW_SECONDS = 3600; // 1 hour per session row

/** Clamp one session row's duration to the realistic ceiling (drops idle/erroneous inflation). */
export function clampSessionSeconds(seconds: number | null | undefined): number {
  const s = seconds ?? 0;
  if (!Number.isFinite(s) || s < 0) return 0;
  return Math.min(s, MAX_SESSION_ROW_SECONDS);
}
