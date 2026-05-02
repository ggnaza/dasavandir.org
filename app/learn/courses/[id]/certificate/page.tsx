import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "./print-button";

function generateCertNumber(userId: string, courseId: string): string {
  // Deterministic cert number: TFA-YEAR-XXXX
  const hash = (userId + courseId).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const year = new Date().getFullYear();
  const num = String(hash % 100000).padStart(5, "0");
  return `TFA-${year}-${num}`;
}

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: lessons }, { data: profile }, { data: progress }] = await Promise.all([
    admin.from("courses").select("id, title, description").eq("id", params.id).eq("published", true).single(),
    admin.from("lessons").select("id").eq("course_id", params.id),
    admin.from("profiles").select("full_name").eq("id", user!.id).single(),
    admin.from("progress").select("lesson_id, completed_at").eq("user_id", user!.id),
  ]);

  if (!course) notFound();

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const totalLessons = lessons?.length ?? 0;
  const allDone = totalLessons > 0 && (lessons ?? []).every((l) => completedIds.has(l.id));

  if (!allDone) redirect(`/learn/courses/${params.id}`);

  // Find latest completion date
  const completionDates = (progress ?? [])
    .filter((p) => (lessons ?? []).some((l) => l.id === p.lesson_id))
    .map((p) => new Date(p.completed_at));
  const completedAt = completionDates.length
    ? new Date(Math.max(...completionDates.map((d) => d.getTime())))
    : new Date();

  const formattedDate = completedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const learnerName = profile?.full_name ?? "Learner";

  // Upsert certificate record for tracking (silent if table not yet migrated)
  const certNumber = generateCertNumber(user!.id, params.id);
  try {
    await admin.from("certificates").upsert(
      { user_id: user!.id, course_id: params.id, certificate_number: certNumber },
      { onConflict: "user_id,course_id" }
    );
  } catch (_) {}

  return (
    <div className="flex flex-col items-center px-4">
      <div className="flex flex-wrap gap-3 mb-8 no-print justify-center">
        <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to course
        </Link>
        <PrintButton />
      </div>

      {/* Certificate */}
      <div
        id="certificate"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl print:shadow-none overflow-hidden"
        style={{ border: "8px solid #EC5328" }}
      >
        {/* Top accent bar */}
        <div style={{ background: "linear-gradient(135deg, #EC5328 0%, #c73d14 100%)" }} className="h-3" />

        <div className="p-8 sm:p-14 text-center">
          {/* Logo / org name */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-3xl sm:text-4xl font-bold" style={{ color: "#EC5328", fontFamily: "serif" }}>Դasavandir</span>
            <span className="text-lg text-gray-400">.org</span>
          </div>

          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">
            Certificate of Completion
          </p>
          <p className="text-gray-500 text-sm mb-5">This certifies that</p>

          {/* Learner name */}
          <div className="relative inline-block mb-6">
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
              {learnerName}
            </h1>
            <div className="h-1 rounded-full mt-2 mx-auto w-3/4" style={{ background: "#EC5328" }} />
          </div>

          <p className="text-gray-600 mb-2 text-sm sm:text-base">has successfully completed the course</p>

          <h2 className="text-xl sm:text-2xl font-bold mb-3" style={{ color: "#EC5328" }}>
            {course.title}
          </h2>

          {course.description && (
            <p className="text-gray-400 text-xs sm:text-sm mb-8 max-w-md mx-auto italic">
              {course.description}
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span style={{ color: "#EC5328" }}>✦</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">Completed on</p>
              <p className="text-sm font-semibold text-gray-700">{formattedDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Certificate ID</p>
              <p className="text-sm font-mono font-semibold text-gray-700">{certNumber}</p>
            </div>
          </div>

          {/* TFA tagline */}
          <p className="text-xs text-gray-300 tracking-wide uppercase mt-8">
            Teach For Armenia · Dasavandir.org
          </p>
        </div>

        {/* Bottom accent bar */}
        <div style={{ background: "linear-gradient(135deg, #EC5328 0%, #c73d14 100%)" }} className="h-3" />
      </div>

      <p className="text-xs text-gray-400 mt-4 no-print">Certificate ID: {certNumber}</p>
    </div>
  );
}
