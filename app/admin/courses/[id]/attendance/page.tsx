import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { AttendanceTracker } from "./attendance-tracker";

export const dynamic = "force-dynamic";

export default async function AttendancePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator", "course_manager"].includes(profile.role)) {
    redirect("/learn");
  }

  const { data: course } = await admin
    .from("courses")
    .select("id, title, timetable_enabled")
    .eq("id", params.id)
    .single();
  if (!course) notFound();

  // Load all timetable entries so the client can group by date
  const { data: entries } = await admin
    .from("timetable_entries")
    .select("id, date, start_time, end_time, title, location, location_type")
    .eq("course_id", params.id)
    .order("date", { ascending: false })
    .order("start_time");

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold mb-1">Attendance</h2>
      <p className="text-sm text-gray-500 mb-6">
        Select a session from the timetable and mark attendance for each learner. Changes are saved automatically.
      </p>
      {!course.timetable_enabled || !entries?.length ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          No timetable sessions found. Enable the timetable and add sessions first under the{" "}
          <a href={`/admin/courses/${params.id}/timetable`} className="underline font-medium">Timetable tab</a>.
        </div>
      ) : (
        <AttendanceTracker courseId={params.id} entries={entries} isManager={profile.role === "course_manager"} />
      )}
    </div>
  );
}
