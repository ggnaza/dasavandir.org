import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { CreateAnnouncementForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({ params }: { params: { id: string } }) {
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
    .select("id, title")
    .eq("id", params.id)
    .single();

  if (!course) notFound();

  const { data: announcements } = await admin
    .from("announcements")
    .select(`
      id, title, body, created_at,
      profiles!author_id ( full_name ),
      comment_count:announcement_comments ( count ),
      reaction_count:announcement_reactions ( count )
    `)
    .eq("course_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
        <p className="text-sm text-gray-500 mt-1">
          Announcements are sent to all enrolled students by email and in-app notification.
        </p>
      </div>

      <CreateAnnouncementForm courseId={params.id} isCourseManager={profile.role === "course_manager"} />

      <div className="mt-8 space-y-4">
        {!announcements?.length && (
          <p className="text-sm text-gray-400 text-center py-8">No announcements yet.</p>
        )}
        {announcements?.map((a) => {
          const author = (a.profiles as any)?.full_name ?? "Unknown";
          const commentCount = (a.comment_count as any)?.[0]?.count ?? 0;
          const reactionCount = (a.reaction_count as any)?.[0]?.count ?? 0;

          return (
            <div key={a.id} className="bg-white border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                  {reactionCount > 0 && <span>👍 {reactionCount}</span>}
                  {commentCount > 0 && <span>💬 {commentCount}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <span>{author}</span>
                <span>·</span>
                <span>{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{a.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
