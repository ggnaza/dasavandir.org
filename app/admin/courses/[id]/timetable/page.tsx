import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { TimetableManager } from "./timetable-manager";
import { GroupTimetableManager, type Override } from "./group-timetable-manager";
import { getTimetableAccess } from "@/lib/timetable/access";

export const dynamic = "force-dynamic";

export default async function TimetablePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator", "course_manager"].includes(profile.role)) {
    redirect("/learn");
  }

  // select("*") so this tolerates the group columns not existing until
  // group_timetables.sql is applied — naming one would 42703 the whole page.
  const { data: course } = await admin.from("courses").select("*").eq("id", params.id).single();
  if (!course) notFound();

  const { data: entries } = await admin
    .from("timetable_entries")
    .select("*")
    .eq("course_id", params.id)
    .order("date")
    .order("start_time");

  const access = await getTimetableAccess(admin, params.id, user.id);
  const { data: groups } = await admin
    .from("course_groups")
    .select("id, name")
    .eq("course_id", params.id);

  // ADR-0005: the creator owns the shared agenda; a moderator layers their group's
  // version on top of it. A manager who moderates no group sees neither editor.
  if (!access.canEditBase && access.moderatedGroups.length > 0) {
    const groupIds = access.moderatedGroups.map((g) => g.id);
    const { data: overrides } = await admin
      .from("timetable_entry_overrides")
      .select("entry_id, group_id, title, start_time, end_time, location, hidden")
      .in("group_id", groupIds);

    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-1">Timetable — your group</h2>
        <p className="text-sm text-gray-500 mb-6">
          The course creator owns the shared agenda. You can adjust the sessions they have opened for
          groups, and your changes apply only to the learners in your group.
        </p>
        <GroupTimetableManager
          courseId={params.id}
          groups={access.moderatedGroups}
          entries={entries ?? []}
          initialOverrides={(overrides ?? []) as Override[]}
        />
      </div>
    );
  }

  if (!access.canEditBase) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-1">Timetable</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 mt-4">
          You have read-only access to this course&apos;s timetable. Only the course creator and admins
          edit the shared agenda; moderators can additionally adjust the sessions opened for their own
          group. Ask an admin to make you a group moderator if you need to adjust sessions.
        </div>
        <div className="mt-5 bg-white border rounded-xl divide-y">
          {(entries ?? []).map((e) => (
            <div key={e.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xs font-mono text-gray-500 w-36 shrink-0">
                {e.date} {String(e.start_time).slice(0, 5)}
              </span>
              <span className="text-sm">{e.title}</span>
            </div>
          ))}
          {(entries ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No schedule entries yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-1">Timetable</h2>
      <p className="text-sm text-gray-500 mb-6">
        Add schedule slots for this course. Click any field to edit it in place — inline edits are
        saved silently and do not notify anyone. Emailing learners is a separate, deliberate act: the
        &ldquo;Announce&rdquo; button on a single entry, or the daily agenda toggle below.
        {(groups?.length ?? 0) > 0 && (
          <> Mark a session <span className="text-purple-700">◈ Groups may adjust</span> to let its
          group moderators tailor it for their own learners.</>
        )}
      </p>
      <TimetableManager
        courseId={params.id}
        enabled={course.timetable_enabled}
        dailyAnnouncements={(course as { timetable_daily_announcements?: boolean }).timetable_daily_announcements ?? false}
        initialEntries={entries ?? []}
        groupCount={groups?.length ?? 0}
      />
    </div>
  );
}
