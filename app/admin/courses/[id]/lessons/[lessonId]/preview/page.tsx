import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";
import { ChapterView } from "@/app/learn/courses/[id]/lessons/[lessonId]/chapter-view";
import { PreviewVideoPlayer } from "./preview-video-player";

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

export default async function LessonPreviewPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const admin = createAdminClient();
  const [{ data: lesson }, { data: files }] = await Promise.all([
    admin.from("lessons").select("*").eq("id", params.lessonId).single(),
    admin.from("lesson_files").select("id, file_name, storage_path").eq("lesson_id", params.lessonId).order("created_at"),
  ]);

  if (!lesson) notFound();

  const isStorageVideo = !!lesson.video_url && !lesson.video_url.startsWith("http");
  let resolvedVideoUrl: string | null = lesson.video_url ?? null;
  if (isStorageVideo) {
    const { data: signed } = await admin.storage
      .from("lesson-videos")
      .createSignedUrl(lesson.video_url, 3600);
    resolvedVideoUrl = signed?.signedUrl ?? null;
  }

  const embedUrl = !isStorageVideo && lesson.video_url ? getEmbedUrl(lesson.video_url) : null;
  const slidesEmbedUrl = lesson.slides_url ? getSlidesEmbedUrl(lesson.slides_url) : null;
  const bucketUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lesson-files`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
        <p className="text-sm font-medium text-amber-800">👁 Preview — this is what learners see</p>
        <p className="text-xs text-amber-600">Navigation, progress tracking, and completion buttons are hidden in this view</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{lesson.title}</h1>

        {/* Video with chapters */}
        {resolvedVideoUrl && lesson.chapters?.length > 0 ? (
          <ChapterView chapters={lesson.chapters} videoUrl={resolvedVideoUrl} isStorageVideo={isStorageVideo} />
        ) : isStorageVideo && resolvedVideoUrl ? (
          <PreviewVideoPlayer src={resolvedVideoUrl} />
        ) : embedUrl ? (
          <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-black">
            <iframe src={embedUrl} className="w-full h-full" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        ) : null}

        {/* Slides */}
        {slidesEmbedUrl && (
          <div className="mb-6 rounded-xl overflow-hidden border" style={{ aspectRatio: "16/9" }}>
            <iframe src={slidesEmbedUrl} className="w-full h-full" allowFullScreen allow="autoplay" />
          </div>
        )}

        {/* Document */}
        {lesson.document_url && (
          <div className="mb-6 rounded-xl overflow-hidden border bg-gray-50" style={{ height: "500px" }}>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.document_url)}&embedded=true`}
              className="w-full h-full"
              title="Document viewer"
            />
          </div>
        )}

        {/* Audio */}
        {lesson.audio_url && (
          <div className="bg-white border rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
            <span className="text-xl shrink-0">🎧</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Listen to this lesson</p>
              <audio controls className="w-full h-9" src={lesson.audio_url} />
            </div>
          </div>
        )}

        {/* Text content */}
        {lesson.content && (
          <div className="bg-white border rounded-xl p-4 sm:p-6 mb-6">
            <LessonHtmlRenderer content={lesson.content} />
          </div>
        )}

        {/* Files */}
        {files && files.length > 0 && (
          <div className="bg-white border rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold mb-3">Lesson files</p>
            <div className="space-y-2">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={`${bucketUrl}/${f.storage_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-brand-600 hover:underline"
                >
                  <span>📎</span> {f.file_name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
