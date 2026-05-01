import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MarkCompleteButton } from "./mark-complete-button";
import { AiCoach } from "./ai-coach";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";
import { LessonFiles } from "./lesson-files";
import { SessionTracker } from "./session-tracker";
import { VideoTracker } from "./video-tracker";
import { ChapterView } from "./chapter-view";

function getSlidesEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com")) {
      const match = u.pathname.match(/\/presentation\/d\/([^/]+)/);
      if (match) return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    return url;
  } catch { return null; }
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}`;
    if (u.hostname.includes("drive.google.com")) {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return null;
  } catch { return null; }
}

function deadlineLabel(lesson: any, enrolledAt: string | null): { label: string; overdue: boolean } | null {
  if (!lesson.deadline_days && !lesson.deadline_date) return null;
  const now = new Date();

  if (lesson.deadline_date) {
    const due = new Date(lesson.deadline_date);
    const diffDays = Math.round((now.getTime() - due.getTime()) / 86400000);
    if (diffDays > 0) return { label: `${diffDays}d overdue`, overdue: true };
    if (diffDays === 0) return { label: "Due today", overdue: false };
    return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, overdue: false };
  }

  if (lesson.deadline_days && enrolledAt) {
    const due = new Date(new Date(enrolledAt).getTime() + lesson.deadline_days * 86400000);
    const diffDays = Math.round((now.getTime() - due.getTime()) / 86400000);
    if (diffDays > 0) return { label: `${diffDays}d overdue`, overdue: true };
    if (diffDays === 0) return { label: "Due today", overdue: false };
    return { label: `Due in ${-diffDays}d`, overdue: false };
  }
  return null;
}

export default async function LessonPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: lesson }, { data: lessons }, { data: allProgress }, { data: quiz }, { data: files }, { data: assignment }, { data: enrollment }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("lessons").select("id, title, order, deadline_days, deadline_date").eq("course_id", params.id).order("order"),
    admin.from("progress").select("lesson_id").eq("user_id", user!.id),
    admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
    admin.from("assignments").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("enrollments").select("id, created_at").eq("user_id", user!.id).eq("course_id", params.id).single(),
  ]);

  if (!lesson) notFound();

  if (!enrollment) {
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

  // Check quiz score for 80% gate
  let quizPassed = true; // default pass if no quiz
  if (quiz?.id) {
    const { data: latestResponse } = await admin
      .from("quiz_responses")
      .select("score")
      .eq("quiz_id", quiz.id)
      .eq("user_id", user!.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single();
    quizPassed = latestResponse ? (latestResponse.score ?? 0) >= 80 : false;
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

  const enrolledAt = enrollment?.created_at ?? null;
  const deadlineInfo = deadlineLabel(lesson, enrolledAt);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0 w-full">
        <SessionTracker lessonId={params.lessonId} userId={user!.id} />

        <div className="flex items-center justify-between mb-2">
          <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to course
          </Link>
          {deadlineInfo && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${deadlineInfo.overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
              {deadlineInfo.overdue ? "🔴" : "🕐"} {deadlineInfo.label}
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-6">{lesson.title}</h1>

        {lesson.video_url && lesson.chapters?.length > 0 ? (
          <ChapterView chapters={lesson.chapters} videoUrl={lesson.video_url} />
        ) : embedUrl && (
          <VideoTracker
            embedUrl={embedUrl}
            isYouTube={!!(lesson.video_url && (lesson.video_url.includes("youtube.com") || lesson.video_url.includes("youtu.be")))}
            lessonId={params.lessonId}
            userId={user!.id}
            isCompleted={isCompleted}
          />
        )}

        {slidesEmbedUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border" style={{ aspectRatio: "16/9" }}>
            <iframe src={slidesEmbedUrl} className="w-full h-full" allowFullScreen allow="autoplay" />
          </div>
        )}

        {lesson.document_url && (
          <div className="mb-6 rounded-xl overflow-hidden border bg-gray-50" style={{ height: "500px" }}>
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
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Listen to this lesson</p>
              <audio controls className="w-full h-9" src={lesson.audio_url} />
            </div>
          </div>
        )}

        {lesson.content && (
          <div className="bg-white border rounded-xl p-4 sm:p-6 mb-6">
            <LessonHtmlRenderer content={lesson.content} />
          </div>
        )}

        <LessonFiles
          files={files ?? []}
          bucketUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lesson-files`}
        />

        <div className="flex flex-wrap gap-3 mb-4">
          {quiz && (
            <Link
              href={`/learn/courses/${params.id}/lessons/${params.lessonId}/quiz`}
              className={`text-sm rounded-lg px-4 py-2 border ${quizPassed ? "border-green-400 text-green-700 bg-green-50" : "border-brand-500 text-brand-600 hover:bg-brand-50"}`}
            >
              {quizPassed ? "✓ Quiz passed" : "Take quiz →"}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {prevLesson && (
              <Link href={`/learn/courses/${params.id}/lessons/${prevLesson.id}`} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">
                ← Prev
              </Link>
            )}
            {nextLesson && (
              <Link href={`/learn/courses/${params.id}/lessons/${nextLesson.id}`} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">
                Next →
              </Link>
            )}
          </div>
          <MarkCompleteButton
            lessonId={params.lessonId}
            userId={user!.id}
            isCompleted={isCompleted}
            courseId={params.id}
            hasQuiz={!!quiz}
            quizPassed={quizPassed}
          />
        </div>

        {completedCount === totalLessons && totalLessons > 0 && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-green-800">Course complete! 🎉</p>
              <p className="text-sm text-green-600">You've finished all {totalLessons} lessons.</p>
            </div>
            <Link
              href={`/learn/courses/${params.id}/certificate`}
              className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium whitespace-nowrap"
            >
              Get certificate →
            </Link>
          </div>
        )}

        <AiCoach lessonId={params.lessonId} courseId={params.id} userId={user!.id} />
      </div>

      {/* Sticky sidebar — hidden on mobile, shown on lg+ */}
      <aside className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-6">
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lessons</p>
            <span className="text-xs text-gray-400">{completedCount}/{totalLessons}</span>
          </div>
          {totalLessons > 0 && (
            <div className="h-1 bg-gray-100 rounded-full mb-3">
              <div className="h-1 bg-brand-500 rounded-full transition-all" style={{ width: `${Math.round((completedCount / totalLessons) * 100)}%` }} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-0.5">
            {lessons?.map((l, i) => {
              const done = completedIds.has(l.id);
              const current = l.id === params.lessonId;
              const dl = deadlineLabel(l, enrolledAt);
              return (
                <Link
                  key={l.id}
                  href={`/learn/courses/${params.id}/lessons/${l.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${current ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-gray-50 text-gray-600"}`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-medium ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="truncate flex-1">{l.title}</span>
                  {dl?.overdue && !done && <span className="text-red-500 text-xs shrink-0">!</span>}
                </Link>
              );
            })}
          </div>
          {completedCount === totalLessons && totalLessons > 0 && (
            <div className="mt-3 pt-3 border-t">
              <Link href={`/learn/courses/${params.id}/certificate`} className="flex items-center justify-center gap-1.5 text-sm text-green-700 font-medium hover:underline">
                <span>🏆</span> View certificate
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
