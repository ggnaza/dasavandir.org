import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MarkCompleteButton } from "./mark-complete-button";
import { AiCoach } from "./ai-coach";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";
import { LessonFiles } from "./lesson-files";

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function LessonPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: lesson }, { data: lessons }, { data: progress }, { data: quiz }, { data: files }, { data: assignment }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id).eq("lesson_id", params.lessonId).single(),
    admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
    admin.from("assignments").select("id").eq("lesson_id", params.lessonId).single(),
  ]);

  if (!lesson) notFound();

  const isCompleted = !!progress;
  const embedUrl = lesson.video_url ? getEmbedUrl(lesson.video_url) : null;

  const currentIndex = lessons?.findIndex((l) => l.id === params.lessonId) ?? 0;
  const prevLesson = lessons?.[currentIndex - 1];
  const nextLesson = lessons?.[currentIndex + 1];

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to course
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">{lesson.title}</h1>

      {embedUrl && (
        <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-black">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}

      {lesson.content && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <LessonHtmlRenderer content={lesson.content} />
        </div>
      )}

      <LessonFiles
        files={files ?? []}
        bucketUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lesson-files`}
      />

      <div className="flex gap-3 mb-4">
        {quiz && (
          <Link
            href={`/learn/courses/${params.id}/lessons/${params.lessonId}/quiz`}
            className="text-sm border border-brand-500 text-brand-600 rounded-lg px-4 py-2 hover:bg-brand-50"
          >
            Take quiz →
          </Link>
        )}
        {assignment && (
          <Link
            href={`/learn/courses/${params.id}/lessons/${params.lessonId}/assignment`}
            className="text-sm border border-purple-400 text-purple-600 rounded-lg px-4 py-2 hover:bg-purple-50"
          >
            Assignment →
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {prevLesson && (
            <Link
              href={`/learn/courses/${params.id}/lessons/${prevLesson.id}`}
              className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          {nextLesson && (
            <Link
              href={`/learn/courses/${params.id}/lessons/${nextLesson.id}`}
              className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              Next →
            </Link>
          )}
        </div>
        <MarkCompleteButton
          lessonId={params.lessonId}
          userId={user!.id}
          isCompleted={isCompleted}
          courseId={params.id}
        />
      </div>
      <AiCoach lessonId={params.lessonId} />
    </div>
  );
}
