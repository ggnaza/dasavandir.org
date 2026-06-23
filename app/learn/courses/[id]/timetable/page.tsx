import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LearnTimetablePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: course } = await admin
    .from("courses")
    .select("id, title, timetable_enabled")
    .eq("id", params.id)
    .single();
  if (!course || !course.timetable_enabled) notFound();

  // Must be enrolled
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", params.id)
    .maybeSingle();
  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: entries } = await admin
    .from("timetable_entries")
    .select("*")
    .eq("course_id", params.id)
    .order("date")
    .order("start_time");

  // Today in Armenia time (UTC+4)
  const armeniaMs = Date.now() + 4 * 60 * 60 * 1000;
  const today = new Date(armeniaMs).toISOString().slice(0, 10);

  // Group by date
  const byDate: Record<string, typeof entries> = {};
  for (const e of entries ?? []) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date]!.push(e);
  }

  const sortedDates = Object.keys(byDate).sort();
  const pastDates = sortedDates.filter((d) => d < today);
  const todayDates = sortedDates.filter((d) => d === today);
  const futureDates = sortedDates.filter((d) => d > today);

  function formatDate(date: string) {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  function EntryRow({ e }: { e: NonNullable<typeof entries>[number] }) {
    const timeStr = e.end_time
      ? `${e.start_time.slice(0, 5)} – ${e.end_time.slice(0, 5)}`
      : e.start_time.slice(0, 5);
    return (
      <div className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
        <div className="text-sm font-mono text-gray-500 shrink-0 pt-0.5 w-24">{timeStr}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{e.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {e.location_type === "online" ? "Online" : "In person"} — {e.location}
          </p>
          {e.description && <p className="text-xs text-gray-400 mt-1">{e.description}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${e.location_type === "online" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-700"}`}>
          {e.location_type === "online" ? "Online" : "In person"}
        </span>
      </div>
    );
  }

  function DayBlock({ date, dayEntries, highlight }: { date: string; dayEntries: NonNullable<typeof entries>; highlight?: boolean }) {
    return (
      <div className={`rounded-xl overflow-hidden border ${highlight ? "border-brand-400 shadow-sm" : ""}`}>
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${highlight ? "bg-brand-50" : "bg-gray-50"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-brand-700" : "text-gray-600"}`}>
            {formatDate(date)}
          </p>
          {highlight && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">Today</span>}
        </div>
        <div className="bg-white">
          {dayEntries.map((e) => <EntryRow key={e.id} e={e} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to course
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-6">Course Schedule</h1>

      {sortedDates.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">No schedule has been added yet.</p>
      )}

      <div className="space-y-4">
        {todayDates.map((d) => (
          <DayBlock key={d} date={d} dayEntries={byDate[d]!} highlight />
        ))}
        {futureDates.map((d) => (
          <DayBlock key={d} date={d} dayEntries={byDate[d]!} />
        ))}
        {pastDates.length > 0 && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium pt-2">Past sessions</p>
            {pastDates.map((d) => (
              <div key={d} className="opacity-50">
                <DayBlock date={d} dayEntries={byDate[d]!} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
