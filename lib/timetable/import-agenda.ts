import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEntry } from "./parse-agenda-sheet";

export type ImportPlan = {
  /** Existing rows matched by date+time — updated in place, never duplicated. */
  adopt: { entryId: string; entry: ParsedEntry; oldTitle: string }[];
  /** Rows already carrying this source_key — a re-import; updated in place. */
  update: { entryId: string; entry: ParsedEntry; oldTitle: string }[];
  insert: ParsedEntry[];
  /** In the course but absent from the sheet. Never auto-deleted. */
  orphan: { id: string; date: string; start_time: string; title: string }[];
};

type Row = {
  id: string;
  date: string;
  start_time: string;
  title: string;
  source_key: string | null;
};

const timeKey = (date: string, t: string) => `${date}|${String(t).slice(0, 5)}`;

/**
 * Work out what an import would do, without writing anything.
 *
 * Three-way match, in priority order:
 *  1. by source_key   — a re-import of a cell we've seen before; update in place.
 *     This is what keeps moderator overrides alive: they FK to timetable_entries.id,
 *     so a DELETE+INSERT import would silently destroy every group's adjustments.
 *  2. by date+time    — a row someone entered by hand before the importer existed.
 *     Adopt it (update + stamp source_key) rather than creating a near-duplicate
 *     beside it.
 *  3. otherwise       — insert.
 *
 * Orphans are reported, never deleted: a row missing from the sheet may be a
 * deliberate manual addition, and silently removing a session from a live course
 * is not a call an importer gets to make.
 */
export async function planImport(
  admin: SupabaseClient,
  courseId: string,
  parsed: ParsedEntry[],
): Promise<ImportPlan> {
  const { data, error } = await admin
    .from("timetable_entries")
    .select("id, date, start_time, title, source_key")
    .eq("course_id", courseId);

  if (error) throw new Error(`Could not read existing entries: ${error.message}`);

  const rows = (data ?? []) as Row[];
  const bySource = new Map(rows.filter((r) => r.source_key).map((r) => [r.source_key!, r]));
  const byTime = new Map(rows.filter((r) => !r.source_key).map((r) => [timeKey(r.date, r.start_time), r]));

  const plan: ImportPlan = { adopt: [], update: [], insert: [], orphan: [] };
  const consumed = new Set<string>();

  for (const entry of parsed) {
    const bySrc = bySource.get(entry.sourceKey);
    if (bySrc) {
      plan.update.push({ entryId: bySrc.id, entry, oldTitle: bySrc.title });
      consumed.add(bySrc.id);
      continue;
    }
    const byT = byTime.get(timeKey(entry.date, entry.startTime));
    if (byT && !consumed.has(byT.id)) {
      plan.adopt.push({ entryId: byT.id, entry, oldTitle: byT.title });
      consumed.add(byT.id);
      continue;
    }
    plan.insert.push(entry);
  }

  plan.orphan = rows
    .filter((r) => !consumed.has(r.id))
    .map((r) => ({ id: r.id, date: r.date, start_time: r.start_time, title: r.title }));

  return plan;
}

export type ApplyOptions = {
  /** false = adopt existing rows for future re-imports but keep their titles. */
  overwriteTitles: boolean;
  /** Only import entries on or before this date (YYYY-MM-DD). */
  upToDate?: string;
};

export type ApplyResult = { adopted: number; updated: number; inserted: number; skipped: number };

/**
 * Apply a plan. Updates in place and inserts; never deletes.
 *
 * Deliberately does NOT announce. Populating a schedule and emailing 72 learners
 * about it are different acts — the daily cron is gated on
 * courses.timetable_daily_announcements.
 */
export async function applyImport(
  admin: SupabaseClient,
  courseId: string,
  plan: ImportPlan,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  const withinRange = (e: ParsedEntry) => !opts.upToDate || e.date <= opts.upToDate;
  const result: ApplyResult = { adopted: 0, updated: 0, inserted: 0, skipped: 0 };

  const patch = (e: ParsedEntry, includeTitle: boolean) => ({
    ...(includeTitle ? { title: e.title } : {}),
    start_time: e.startTime,
    end_time: e.endTime,
    source_key: e.sourceKey,
    updated_at: new Date().toISOString(),
  });

  for (const { entryId, entry } of plan.update) {
    if (!withinRange(entry)) { result.skipped++; continue; }
    const { error } = await admin.from("timetable_entries").update(patch(entry, true)).eq("id", entryId).eq("course_id", courseId);
    if (error) throw new Error(`update ${entryId}: ${error.message}`);
    result.updated++;
  }

  for (const { entryId, entry } of plan.adopt) {
    if (!withinRange(entry)) { result.skipped++; continue; }
    const { error } = await admin
      .from("timetable_entries")
      .update(patch(entry, opts.overwriteTitles))
      .eq("id", entryId)
      .eq("course_id", courseId);
    if (error) throw new Error(`adopt ${entryId}: ${error.message}`);
    result.adopted++;
  }

  const toInsert = plan.insert.filter(withinRange);
  result.skipped += plan.insert.length - toInsert.length;

  // Chunked: a single 300-row insert is one long statement and one all-or-nothing
  // failure; chunks keep a bad row's blast radius small and the progress legible.
  for (let i = 0; i < toInsert.length; i += 50) {
    const chunk = toInsert.slice(i, i + 50).map((e) => ({
      course_id: courseId,
      date: e.date,
      start_time: e.startTime,
      end_time: e.endTime,
      title: e.title,
      location: "Online",
      location_type: "online",
      source_key: e.sourceKey,
    }));
    const { error } = await admin.from("timetable_entries").insert(chunk);
    if (error) throw new Error(`insert chunk ${i}: ${error.message}`);
    result.inserted += chunk.length;
  }

  return result;
}
