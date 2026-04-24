import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MarkCompleteButton } from "./mark-complete-button";
import { AiCoach } from "./ai-coach";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";
import { LessonFiles } from "./lesson-files";
import { SessionTracker } from "./session-tracker";

function getSlidesEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Google Slides share/edit link → embed
    if (u.hostname.includes("docs.google.com")) {
      const match = u.pathname.match(/\/presentation\/d\/([^/]+)/);
      if (match) return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    // Already an embed URL or Canva/other — use as-is
    return url;
  } catch {
    return null;
  }
}

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
    if (u.hostname.includes("drive.google.com")) {
      // Supports: /file/d/FILE_ID/view and /file/d/FILE_ID/preview
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
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

  const [{ data: lesson }, { data: lessons }, { data: allProgress }, { data: quiz }, { data: files }, { data: assignment }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("lessons").select("id, title, order").eq("course_id", params.id).order("order"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
    admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
    admin.from("assignments").select("id").eq("lesson_id", params.lessonId).single(),
  ]);

  if (!lesson) notFound();

  // Enrollment gate
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) {
    // Auto-enroll if user already has progress (migration compat)
    const hasProgress = (allProgress ?? []).length > 0;
    if (hasProgress) {
      await admin.from("enrollments").upsert(
        { user_id: user!.id, course_id: params.id },
        { onConflict: "user_id,course_id" }
      );
    } else {
      redirect(`/courses/${params.id}`);
    }
  }

  const completedIds = new Set((allProgress ?? []).map((p) => p.lesson_id));
  const isCompleted = completedIds.has(params.lessonId);
  const embedUrl = lesson.video_url ? getEmbedUrl(lesson.video_url) : null;
  const slidesEmbedUrl = lesson.slides_url ? getSlidesEmbedUrl(lesson.slides_url) : null;

  const currentIndex = lessons?.findIndex((l) => l.id === params.lessonId) ?? 0;
  const prevLesson = lessons?.[currentIndex - 1];
  const nextLesson = lessons?.[currentIndex + 1];

  const totalLessons = lessons?.length ?? 0;
  const completedCount = lessons?.filter((l) => completedIds.has(l.id)).length ?? 0;

  return (
    <div className="flex gap-8 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <SessionTracker lessonId={params.lessonId} userId={user!.id} />

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

        {slidesEmbedUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={slidesEmbedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay"
            />
          </div>
        )}

        {lesson.document_url && (
          <div className="mb-6 rounded-xl overflow-hidden border bg-gray-50" style={{ height: "600px" }}>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.document_url)}&embedded=true`}
              className="w-full h-full"
              title="Document viewer"
            />
          </div>
        )}

        {lesson.audio_url && (
          <div className="bg-white border rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
            <span className="text-xl shrink-0">🎧</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Listen to this lesson</p>
              <audio controls className="w-full h-9" src={lesson.audio_url} />
            </div>
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

        {completedCount === totalLessons && totalLessons > 0 && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800">Course complete!</p>
              <p className="text-sm text-green-600">You've finished all {totalLessons} lessons.</p>
            </div>
            <Link
              href={`/learn/courses/${params.id}/certificate`}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              Get certificate →
            </Link>
          </div>
        )}

        <AiCoach lessonId={params.lessonId} />
      </div>

      {/* Sticky sidebar */}
      <aside className="w-64 shrink-0 hidden lg:block sticky top-6">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lessons</p>
            <span className="text-xs text-gray-400">{completedCount}/{totalLessons}</span>
          </div>
          {totalLessons > 0 && (
            <div className="h-1 bg-gray-100 rounded-full mb-3">
              <div
                className="h-1 bg-brand-500 rounded-full transition-all"
                style={{ width: `${Math.round((completedCount / totalLessons) * 100)}%` }}
              />
            </div>
          )}
          <div className="space-y-0.5">
            {lessons?.map((l, i) => {
              const done = completedIds.has(l.id);
              const current = l.id === params.lessonId;
              return (
                <Link
                  key={l.id}
                  href={`/learn/courses/${params.id}/lessons/${l.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    current
                      ? "bg-brand-50 text-brand-700 font-medium"
                      : "hover:bg-gray-50 text-gray-600"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-medium ${
                      done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="truncate">{l.title}</span>
                </Link>
              );
            })}
          </div>
          {completedCount === totalLessons && totalLessons > 0 && (
            <div className="mt-3 pt-3 border-t">
              <Link
                href={`/learn/courses/${params.id}/certificate`}
                className="flex items-center justify-center gap-1.5 text-sm text-green-700 font-medium hover:underline"
              >
                <span>🏆</span> View certificate
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
