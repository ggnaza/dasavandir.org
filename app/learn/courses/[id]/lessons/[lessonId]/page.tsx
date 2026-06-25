import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MarkCompleteButton } from "./mark-complete-button";
import { AiCoach } from "../../ai-coach";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";
import { LessonFiles } from "./lesson-files";
import { SessionTracker } from "./session-tracker";
import { VideoTracker } from "./video-tracker";
import { ChapterView } from "./chapter-view";
import { SlideAudioPlayer } from "./slide-audio-player";

function getLinkIcon(url: string): string {
  if (url.includes("docs.google.com/spreadsheets")) return "📊";
  if (url.includes("docs.google.com/document")) return "📝";
  if (url.includes("docs.google.com/presentation")) return "📊";
  if (url.includes("docs.google.com/forms")) return "📋";
  if (url.includes("drive.google.com")) return "📁";
  if (url.includes("canva.com")) return "🎨";
  if (url.match(/\.(pdf)$/i)) return "📄";
  if (url.match(/\.(mp4|mov|avi|webm)$/i)) return "🎬";
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return "🖼";
  return "🔗";
}

function getSlidesEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com")) {
      const match = u.pathname.match(/\/presentation\/d\/([^/]+)/);
      if (match) return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
    }
    // Canva share links need ?embed appended to allow iframe embedding
    if (u.hostname.includes("canva.com")) {
      if (!u.searchParams.has("embed")) {
        u.searchParams.set("embed", "");
        return u.toString().replace("embed=", "embed");
      }
      return url;
    }
    return url;
  } catch { return null; }
}

function getDocumentEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    // Google Drive file links → native Drive preview (gview can't render Drive files)
    if (u.hostname.includes("drive.google.com")) {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    // Google Docs / Sheets / Slides → native preview
    if (u.hostname.includes("docs.google.com")) {
      const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    }
    // Direct PDF upload (Supabase storage) → browsers render it natively in an iframe
    if (u.pathname.toLowerCase().endsWith(".pdf")) return url;
    // Other direct files (docx, etc.) → fall back to Google's viewer
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  } catch {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      // YouTube Shorts: /shorts/VIDEO_ID
      const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      // Already an embed URL: /embed/VIDEO_ID
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return url;
      return null;
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

  // First batch: everything except progress (progress needs lesson IDs scoped to this course)
  const [{ data: lesson }, { data: lessons }, { data: quiz }, { data: files }, { data: assignment }, { data: enrollment }, { data: course }, { data: profileData }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("lessons").select("id, title, order, deadline_days, deadline_date").eq("course_id", params.id).order("order"),
    admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
    admin.from("assignments").select("id, is_group_assignment").eq("lesson_id", params.lessonId).single(),
    admin.from("enrollments").select("id, enrolled_at").eq("user_id", user!.id).eq("course_id", params.id).single(),
    admin.from("courses").select("allow_shuffled_learning, pre_submission_ai, ai_coach_enabled, title, access_type, course_type").eq("id", params.id).single(),
    admin.from("profiles").select("full_name").eq("id", user!.id).single(),
  ]);

  if (!lesson) notFound();

  // Resolve effective enrollment — process pending invitations if not yet enrolled
  let effectiveEnrollment = enrollment;
  if (!effectiveEnrollment) {
    const userEmail = user!.email?.toLowerCase();
    if (userEmail) {
      const { data: pendingInvites } = await admin
        .from("invitations")
        .select("id, course_id")
        .eq("email", userEmail)
        .eq("course_id", params.id)
        .eq("status", "pending");
      if (pendingInvites && pendingInvites.length > 0) {
        await Promise.all(
          pendingInvites.map((inv) =>
            Promise.all([
              admin.from("enrollments").upsert(
                { user_id: user!.id, course_id: inv.course_id },
                { onConflict: "user_id,course_id" }
              ),
              admin.from("invitations").update({ status: "accepted" }).eq("id", inv.id),
            ])
          )
        );
        const { data: newEnrollment } = await admin
          .from("enrollments")
          .select("id, enrolled_at")
          .eq("user_id", user!.id)
          .eq("course_id", params.id)
          .single();
        if (!newEnrollment) {
          const isPrivate = course?.access_type === "private" || course?.course_type === "internal";
          redirect(isPrivate ? "/learn" : `/courses/${params.id}`);
        }
        effectiveEnrollment = newEnrollment;
      } else {
        const isPrivate = course?.access_type === "private" || course?.course_type === "internal";
        redirect(isPrivate ? "/learn" : `/courses/${params.id}`);
      }
    } else {
      const isPrivate = course?.access_type === "private" || course?.course_type === "internal";
      redirect(isPrivate ? "/learn" : `/courses/${params.id}`);
    }
  }

  // Progress scoped to lessons in THIS course only (prevents cross-course leakage)
  const courseLessonIds = (lessons ?? []).map((l) => l.id);
  const { data: allProgress } = courseLessonIds.length
    ? await admin.from("progress").select("lesson_id").eq("user_id", user!.id).in("lesson_id", courseLessonIds)
    : { data: [] };

  // Check assignment approval gate
  let assignmentApproved = true; // default: no assignment → gate open
  if (assignment?.id) {
    // For group assignments, check own row first (fan-out copy), then group row
    const { data: ownSub } = await admin
      .from("submissions")
      .select("status")
      .eq("assignment_id", assignment.id)
      .eq("user_id", user!.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let submissionStatus = ownSub?.status ?? null;

    if (!submissionStatus && assignment.is_group_assignment) {
      // Check if another group member submitted on behalf of the group
      const { data: membership } = await admin
        .from("course_group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (membership?.group_id) {
        const { data: groupSub } = await admin
          .from("submissions")
          .select("status")
          .eq("assignment_id", assignment.id)
          .eq("group_id", membership.group_id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        submissionStatus = groupSub?.status ?? null;
      }
    }

    assignmentApproved = submissionStatus === "approved";
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
  const allowShuffled = course?.allow_shuffled_learning ?? false;
  const aiCoachEnabled = course?.ai_coach_enabled ?? true;
  const firstName = profileData?.full_name?.split(" ")[0]?.trim() ?? "";

  const currentIndex = lessons?.findIndex((l) => l.id === params.lessonId) ?? 0;
  const prevLesson = lessons?.[currentIndex - 1];
  const nextLesson = lessons?.[currentIndex + 1];

  // Sequential gate: if not shuffled, block access if any prior lesson is incomplete
  if (!allowShuffled && currentIndex > 0) {
    const prevLessons = (lessons ?? []).slice(0, currentIndex);
    const firstIncomplete = prevLessons.find((l) => !completedIds.has(l.id));
    if (firstIncomplete) {
      redirect(`/learn/courses/${params.id}/lessons/${firstIncomplete.id}`);
    }
  }

  // Self-hosted video: storage path has no http prefix → generate 8-hour signed URL
  const isStorageVideo = !!lesson.video_url && !lesson.video_url.startsWith("http");
  let resolvedVideoUrl: string | null = lesson.video_url ?? null;
  if (isStorageVideo) {
    const { data: signed } = await admin.storage
      .from("lesson-videos")
      .createSignedUrl(lesson.video_url, 28800);
    resolvedVideoUrl = signed?.signedUrl ?? null;
  }

  const embedUrl = !isStorageVideo && lesson.video_url ? getEmbedUrl(lesson.video_url) : null;
  const slidesEmbedUrl = lesson.slides_url ? getSlidesEmbedUrl(lesson.slides_url) : null;

  // If document_url is a Supabase storage file (lesson-documents bucket is private),
  // generate a signed URL so the learner's browser can load it in the iframe.
  let resolvedDocumentUrl = lesson.document_url ?? null;
  if (resolvedDocumentUrl && resolvedDocumentUrl.includes("/lesson-documents/")) {
    const marker = "/lesson-documents/";
    const idx = resolvedDocumentUrl.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(
        resolvedDocumentUrl.slice(idx + marker.length).split("?")[0]
      );
      const { data: signedDoc } = await admin.storage
        .from("lesson-documents")
        .createSignedUrl(storagePath, 3600);
      if (signedDoc?.signedUrl) resolvedDocumentUrl = signedDoc.signedUrl;
    }
  }

  // Build the viewer src. For PDFs served directly (Supabase signed URL or a
  // direct .pdf link) we use the browser's native PDF viewer and pass open
  // params so it fits to width (no horizontal scroll) while keeping the
  // toolbar (zoom in/out, page navigation) visible.
  let documentSrc: string | null = null;
  if (resolvedDocumentUrl) {
    const isDirectPdf =
      resolvedDocumentUrl.includes("/storage/v1/object/sign/") ||
      resolvedDocumentUrl.split("?")[0].toLowerCase().endsWith(".pdf");
    documentSrc = isDirectPdf
      ? `${resolvedDocumentUrl}#view=FitH&toolbar=1&navpanes=0`
      : getDocumentEmbedUrl(resolvedDocumentUrl);
  }

  // Generate signed URLs for lesson file attachments (bucket is private)
  const signedFiles = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await admin.storage.from("lesson-files").createSignedUrl(f.storage_path, 3600);
      return { id: f.id, file_name: f.file_name, signedUrl: data?.signedUrl ?? "" };
    })
  );

  const totalLessons = lessons?.length ?? 0;
  const completedCount = lessons?.filter((l) => completedIds.has(l.id)).length ?? 0;

  const enrolledAt: string | null = (effectiveEnrollment as any)?.enrolled_at ?? null;
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

        {resolvedVideoUrl && lesson.chapters?.length > 0 ? (
          <ChapterView chapters={lesson.chapters} videoUrl={resolvedVideoUrl} isStorageVideo={isStorageVideo} />
        ) : isStorageVideo && resolvedVideoUrl ? (
          <VideoTracker
            embedUrl={resolvedVideoUrl}
            isYouTube={false}
            isStorageVideo={true}
            lessonId={params.lessonId}
            userId={user!.id}
            isCompleted={isCompleted}
          />
        ) : embedUrl && (
          <VideoTracker
            embedUrl={embedUrl}
            isYouTube={!!(lesson.video_url && (lesson.video_url.includes("youtube.com") || lesson.video_url.includes("youtu.be")))}
            isStorageVideo={false}
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

        {documentSrc && (
          <div className="mb-6 rounded-xl overflow-hidden border bg-gray-50 w-full h-[80vh] max-h-[720px]">
            <iframe
              src={documentSrc}
              className="w-full h-full"
              title="Document viewer"
            />
          </div>
        )}

        {Array.isArray(lesson.slide_audio_urls) && lesson.slide_audio_urls.length > 0 ? (
          <SlideAudioPlayer urls={lesson.slide_audio_urls as string[]} />
        ) : lesson.audio_url ? (
          <div className="bg-white border rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
            <span className="text-xl shrink-0">🎧</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Listen to this lesson</p>
              <audio controls className="w-full h-9" src={lesson.audio_url} />
            </div>
          </div>
        ) : null}

        {lesson.content && (
          <div className="bg-white border rounded-xl p-4 sm:p-6 mb-6">
            <LessonHtmlRenderer content={lesson.content} />
          </div>
        )}

        <LessonFiles files={signedFiles} />

        {Array.isArray(lesson.links) && lesson.links.length > 0 && (
          <div className="bg-white border rounded-xl p-5 mb-6">
            <h3 className="font-medium text-sm mb-3">Resources</h3>
            <ul className="space-y-2">
              {(lesson.links as { label: string; url: string }[]).map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-brand-600 hover:underline"
                  >
                    {getLinkIcon(link.url)}
                    {link.label || link.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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
              allowShuffled || isCompleted ? (
                <Link href={`/learn/courses/${params.id}/lessons/${nextLesson.id}`} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">
                  Next →
                </Link>
              ) : (
                <span className="text-sm border rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed bg-gray-50" title="Complete this lesson first">
                  🔒 Next
                </span>
              )
            )}
          </div>
          <MarkCompleteButton
            lessonId={params.lessonId}
            userId={user!.id}
            isCompleted={isCompleted}
            courseId={params.id}
            hasQuiz={!!quiz}
            quizPassed={quizPassed}
            hasAssignment={!!assignment}
            assignmentApproved={assignmentApproved}
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

        {aiCoachEnabled && <AiCoach lessonId={params.lessonId} courseId={params.id} userId={user!.id} firstName={firstName} lessonTitle={lesson.title} />}
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
              // Locked if sequential AND a prior lesson is not done
              const locked = !allowShuffled && i > 0 && !(lessons.slice(0, i).every((pl) => completedIds.has(pl.id)));
              const Tag = locked ? "span" : Link;
              const tagProps = locked ? {} : { href: `/learn/courses/${params.id}/lessons/${l.id}` };
              return (
                <Tag
                  key={l.id}
                  {...(tagProps as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${current ? "bg-brand-50 text-brand-700 font-medium" : locked ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-50 text-gray-600"}`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-medium ${done ? "bg-green-100 text-green-700" : locked ? "bg-gray-50 text-gray-300" : "bg-gray-100 text-gray-400"}`}>
                    {done ? "✓" : locked ? "🔒" : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="truncate block">{l.title}</span>
                    {locked && <span className="text-xs text-gray-300 block">Complete previous lesson first</span>}
                  </span>
                  {dl?.overdue && !done && <span className="text-red-500 text-xs shrink-0">!</span>}
                </Tag>
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
