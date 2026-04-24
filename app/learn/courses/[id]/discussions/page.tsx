import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export default async function DiscussionsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: course } = await admin
    .from("courses")
    .select("id, title")
    .eq("id", params.id)
    .eq("published", true)
    .single();

  if (!course) notFound();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: discussions } = await admin
    .from("discussions")
    .select(`
      id, title, body, created_at,
      profiles!user_id ( full_name ),
      lessons ( title ),
      reply_count:discussion_replies ( count )
    `)
    .eq("course_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-bold">Discussions</h1>
        <Link
          href={`/learn/courses/${params.id}/discussions/new`}
          className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
        >
          + New discussion
        </Link>
      </div>

      {!discussions?.length && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No discussions yet.</p>
          <p className="text-sm">Be the first to start a conversation!</p>
        </div>
      )}

      <div className="space-y-3">
        {discussions?.map((d) => {
          const author = (d.profiles as any)?.full_name ?? "Unknown";
          const lessonTitle = (d.lessons as any)?.title;
          const replyCount = (d.reply_count as any)?.[0]?.count ?? 0;

          return (
            <Link
              key={d.id}
              href={`/learn/courses/${params.id}/discussions/${d.id}`}
              className="block bg-white border rounded-xl px-5 py-4 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{d.title}</p>
                  <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{d.body}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <span>{author}</span>
                    {lessonTitle && (
                      <>
                        <span>·</span>
                        <span className="text-brand-500">{lessonTitle}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-gray-400">{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
