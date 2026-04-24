import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { DeleteButton } from "./delete-button";
import { ReplyForm } from "./reply-form";

export default async function DiscussionThreadPage({
  params,
}: {
  params: { id: string; discussionId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: course }, { data: discussion }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).eq("published", true).single(),
    admin.from("discussions")
      .select(`*, profiles!user_id ( full_name ), lessons ( title )`)
      .eq("id", params.discussionId)
      .single(),
  ]);

  if (!course) notFound();
  if (!discussion || discussion.course_id !== params.id) notFound();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: replies } = await admin
    .from("discussion_replies")
    .select(`*, profiles!user_id ( full_name )`)
    .eq("discussion_id", params.discussionId)
    .order("created_at", { ascending: true });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}/discussions`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Discussions
      </Link>

      {/* Original post */}
      <div className="mt-4 bg-white border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{discussion.title}</h1>
            {(discussion.lessons as any)?.title && (
              <p className="text-xs text-brand-500 mt-0.5">
                Re: {(discussion.lessons as any).title}
              </p>
            )}
          </div>
          {(discussion.user_id === user!.id || isAdmin) && (
            <DeleteButton
              discussionId={discussion.id}
              courseId={params.id}
              label="Delete"
              endpoint={`/api/discussions/${discussion.id}`}
              redirectTo={`/learn/courses/${params.id}/discussions`}
            />
          )}
        </div>
        <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{discussion.body}</p>
        <p className="text-xs text-gray-400 mt-3">
          {(discussion.profiles as any)?.full_name ?? "Unknown"} · {new Date(discussion.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Replies */}
      <div className="mt-4 space-y-3">
        {replies?.map((reply) => (
          <div key={reply.id} className="bg-gray-50 border rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.body}</p>
              {(reply.user_id === user!.id || isAdmin) && (
                <DeleteButton
                  discussionId={reply.id}
                  courseId={params.id}
                  label="Delete"
                  endpoint={`/api/discussions/${params.discussionId}/replies/${reply.id}`}
                  redirectTo={`/learn/courses/${params.id}/discussions/${params.discussionId}`}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {(reply.profiles as any)?.full_name ?? "Unknown"} · {new Date(reply.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="mt-6">
        <ReplyForm discussionId={params.discussionId} courseId={params.id} />
      </div>
    </div>
  );
}
