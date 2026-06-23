import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { TimetableManager } from "./timetable-manager";

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

  const { data: course } = await admin
    .from("courses")
    .select("id, title, timetable_enabled")
    .eq("id", params.id)
    .single();
  if (!course) notFound();

  const { data: entries } = await admin
    .from("timetable_entries")
    .select("*")
    .eq("course_id", params.id)
    .order("date")
    .order("start_time");

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-1">Timetable</h2>
      <p className="text-sm text-gray-500 mb-6">
        Add schedule slots for this course. Any changes automatically notify enrolled learners.
        At 8:00 AM Armenia time, today&apos;s agenda is sent as an announcement.
      </p>
      <TimetableManager
        courseId={params.id}
        enabled={course.timetable_enabled}
        initialEntries={entries ?? []}
      />
    </div>
  );
}
