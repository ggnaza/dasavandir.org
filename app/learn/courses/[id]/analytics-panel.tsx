import type { CourseStats } from "@/lib/analytics/course-stats";

/**
 * Deliberately a reference line, not a rank.
 *
 * The cohort distributions on a real course are heavily bunched — on TLA 2026, 61
 * of 71 learners fall inside a single 10-point quiz band, and 30 of 72 sit on
 * exactly 10 of 12 lessons. A percentile over that turns a meaningless gap into
 * what reads as a verdict: two quiz points move a learner 29 percentiles, and a
 * 94% learner would be told they are behind 59% of their peers. Showing the median
 * as a marker carries the same information without ranking anyone.
 */
function Tile({
  label,
  value,
  unit,
  fillPct,
  refPct,
  refLabel,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  fillPct: number;
  refPct?: number | null;
  refLabel?: string | null;
  note?: string | null;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="p-4 border-r border-b last:border-r-0 flex-1 min-w-[170px]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2.5">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 leading-none tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>

      <div className="relative h-1.5 bg-gray-100 rounded-full mt-3">
        <div className="absolute inset-y-0 left-0 bg-brand-600 rounded-full" style={{ width: `${clamp(fillPct)}%` }} />
        {refPct != null && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 bg-amber-500 rounded-sm"
            style={{ left: `${clamp(refPct)}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {note && (
        <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
          {refLabel && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />}
          {note}
        </p>
      )}
    </div>
  );
}

export function AnalyticsPanel({
  stats,
  totalLessons,
  showCohort,
}: {
  stats: CourseStats;
  totalLessons: number;
  showCohort: boolean;
}) {
  const { me, cohort } = stats;
  const withCohort = showCohort && cohort !== null;

  const hoursLabel = me.hours < 1 ? `${Math.round(me.hours * 60)}` : me.hours.toFixed(1);
  const hoursUnit = me.hours < 1 ? "min" : "hrs";

  // Hours have no natural ceiling — scale the bar against the cohort median (or
  // the learner's own time when there is no cohort) so the fill stays meaningful.
  const hoursScale = Math.max(me.hours, withCohort ? cohort.hoursMedian * 2 : me.hours, 1);
  const paceScale = Math.max(me.pacePerWeek ?? 0, withCohort ? (cohort.paceMedian ?? 0) * 2 : 0, 1);

  return (
    <section className="bg-white border rounded-xl overflow-hidden mb-6">
      <div className="px-4 py-2.5 border-b bg-gray-50 flex items-baseline gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-700">Your progress</h2>
        {withCohort && (
          <span className="text-[11px] text-gray-400">
            compared with {cohort.size} {cohort.size === 1 ? "classmate" : "classmates"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap">
        <Tile
          label="Lessons complete"
          value={`${me.lessonsDone}`}
          unit={`/ ${totalLessons}`}
          fillPct={totalLessons ? (me.lessonsDone / totalLessons) * 100 : 0}
          refPct={withCohort && totalLessons ? (cohort.lessonsMedian / totalLessons) * 100 : null}
          refLabel={withCohort ? "median" : null}
          note={withCohort ? `Cohort median ${cohort.lessonsMedian} of ${totalLessons}` : null}
        />

        <Tile
          label="Time invested"
          value={hoursLabel}
          unit={hoursUnit}
          fillPct={(me.hours / hoursScale) * 100}
          refPct={withCohort ? (cohort.hoursMedian / hoursScale) * 100 : null}
          refLabel={withCohort ? "median" : null}
          note={withCohort ? `Cohort median ${cohort.hoursMedian.toFixed(1)} hrs` : "Across all your lessons"}
        />

        {me.quizAvg !== null && (
          <Tile
            label="Quiz average"
            value={`${me.quizAvg.toFixed(1)}`}
            unit="%"
            fillPct={me.quizAvg}
            refPct={withCohort && cohort.quizMedian !== null ? cohort.quizMedian : null}
            refLabel={withCohort && cohort.quizMedian !== null ? "median" : null}
            note={
              withCohort && cohort.quizMedian !== null
                ? `Cohort median ${cohort.quizMedian.toFixed(1)}%`
                : null
            }
          />
        )}

        {me.pacePerWeek !== null && (
          <Tile
            label="Pace"
            value={me.pacePerWeek.toFixed(1)}
            unit="/ week"
            fillPct={(me.pacePerWeek / paceScale) * 100}
            refPct={withCohort && cohort.paceMedian !== null ? (cohort.paceMedian / paceScale) * 100 : null}
            refLabel={withCohort && cohort.paceMedian !== null ? "median" : null}
            note={
              withCohort && cohort.paceMedian !== null
                ? `Cohort median ${cohort.paceMedian.toFixed(1)} / week`
                : me.daysEnrolled != null
                  ? `Since you joined ${me.daysEnrolled} days ago`
                  : null
            }
          />
        )}
      </div>
    </section>
  );
}
