import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-yellow-100 text-yellow-700",
  ai_reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  returned: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  ai_reviewed: "Needs review",
  approved: "Approved",
  returned: "Returned",
};

export default async function CapstoneSubmissionsPage() {
  const admin = createAdminClient();

  const { data: submissions } = await admin
    .from("capstone_submissions")
    .select(`
      id, status, ai_total_score, final_score, submitted_at,
      user_id, profiles(full_name),
      capstone_id, capstones(title, course_id, courses(title))
    `)
    .order("submitted_at", { ascending: false });

  const pending = submissions?.filter((s) => s.status === "ai_reviewed") ?? [];
  const others = submissions?.filter((s) => s.status !== "ai_reviewed") ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Capstone Submissions</h1>

      {!submissions?.length && (
        <p className="text-gray-500">No capstone submissions yet.</p>
      )}

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
            Needs review ({pending.length})
          </h2>
          <SubmissionTable submissions={pending} />
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            All other submissions
          </h2>
          <SubmissionTable submissions={others} />
        </div>
      )}
    </div>
  );
}

function SubmissionTable({ submissions }: { submissions: any[] }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Learner</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Capstone</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Course</th>
            <th className="text-center px-4 py-3 font-medium text-gray-500">AI Score</th>
            <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {submissions.map((s) => {
            const capstone = s.capstones as any;
            const course = capstone?.courses as any;
            const profile = s.profiles as any;

            return (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{profile?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{capstone?.title ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{course?.title ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  {s.ai_total_score != null ? `${s.ai_total_score}` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/capstone-submissions/${s.id}`}
                    className="text-brand-600 hover:underline text-sm"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
