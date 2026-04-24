import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { InviteForm } from "./invite-form";

export default async function InvitationsPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: invitations }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin
      .from("invitations")
      .select("id, email, status, created_at")
      .eq("course_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!course) notFound();

  const pending = (invitations ?? []).filter((i) => i.status === "pending");
  const accepted = (invitations ?? []).filter((i) => i.status === "accepted");

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to course
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Invitations</h1>
      <p className="text-sm text-gray-500 mb-8">
        Invite learners to <span className="font-medium text-gray-700">{course.title}</span>.
        Invited users are auto-enrolled when they sign in, even for paid courses.
      </p>

      <InviteForm courseId={course.id} />

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pending ({pending.length})
          </h2>
          <div className="bg-white border rounded-xl divide-y">
            {pending.map((inv) => (
              <InviteRow key={inv.id} inv={inv} courseId={course.id} />
            ))}
          </div>
        </div>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Accepted ({accepted.length})
          </h2>
          <div className="bg-white border rounded-xl divide-y">
            {accepted.map((inv) => (
              <InviteRow key={inv.id} inv={inv} courseId={course.id} />
            ))}
          </div>
        </div>
      )}

      {!invitations?.length && (
        <p className="mt-8 text-sm text-gray-400">No invitations yet.</p>
      )}
    </div>
  );
}

function InviteRow({ inv, courseId }: { inv: any; courseId: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-gray-700">{inv.email}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        inv.status === "accepted" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
      }`}>
        {inv.status === "accepted" ? "Enrolled" : "Pending"}
      </span>
    </div>
  );
}
